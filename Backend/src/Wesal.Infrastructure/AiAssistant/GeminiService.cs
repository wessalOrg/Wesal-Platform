using System.Text.Json;
using System.Text.Json.Nodes;
using Google.GenAI;
using Google.GenAI.Types;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;

using GenAiClient = Google.GenAI.Client;
using GenAiContent = Google.GenAI.Types.Content;
using GenAiFunctionCall = Google.GenAI.Types.FunctionCall;
using GenAiFunctionResponse = Google.GenAI.Types.FunctionResponse;
using GenAiFunctionDeclaration = Google.GenAI.Types.FunctionDeclaration;
using GenAiPart = Google.GenAI.Types.Part;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>
/// Infrastructure adapter for Google's official Gen AI .NET SDK. Google types and
/// wire formats stay inside Infrastructure; Application receives only Wesal DTOs.
/// SDK-returned model content is carried as opaque, in-memory continuation state so
/// thought signatures and all provider fields modeled by the SDK are replayed exactly.
/// </summary>
public sealed class GeminiService : IGeminiService, IGeminiToolCallService, IDisposable
{
    internal const int MaxToolRequestContents = 30;
    private const int MaxProviderContinuationCharacters = 128_000;
    private static readonly JsonSerializerOptions AppJsonOptions = new(JsonSerializerDefaults.Web);

    private readonly GoogleAiSettings _settings;
    private readonly ILogger<GeminiService> _logger;
    private readonly GenAiClient? _client;
    private long _circuitOpenUntilTicks;
    private int _consecutiveFailures;

    public GeminiService(IOptions<GoogleAiSettings> settings, ILogger<GeminiService> logger)
    {
        _settings = settings.Value;
        _logger = logger;
        if (_settings.Enabled && !string.IsNullOrWhiteSpace(_settings.ApiKey))
        {
            var (baseUrl, apiVersion) = GetEndpoint(_settings.BaseUrl);
            _client = new GenAiClient(
                apiKey: _settings.ApiKey,
                httpOptions: new HttpOptions
                {
                    BaseUrl = baseUrl,
                    ApiVersion = apiVersion,
                    Timeout = Math.Clamp(_settings.TimeoutSeconds, 1, 120) * 1000,
                    // Avoid hidden duplicate billable requests and keep the
                    // orchestrator's whole-turn budget authoritative.
                    RetryOptions = new HttpRetryOptions { Attempts = 1 }
                });
        }
    }

    // Kept as a source-compatible constructor for existing tests and callers while
    // the adapter has moved to the SDK. The SDK owns its HTTP stack and endpoint.
    public GeminiService(
        IHttpClientFactory unusedHttpClientFactory,
        IOptions<GoogleAiSettings> settings,
        ILogger<GeminiService> logger)
        : this(settings, logger)
    {
        _ = unusedHttpClientFactory;
    }

    public bool IsAvailable
    {
        get
        {
            if (_client is null)
                return false;

            var until = Volatile.Read(ref _circuitOpenUntilTicks);
            if (until > 0 && System.Environment.TickCount64 < until)
                return false;
            if (until > 0)
            {
                Volatile.Write(ref _circuitOpenUntilTicks, 0);
                Volatile.Write(ref _consecutiveFailures, 0);
            }

            return true;
        }
    }

    private void RecordFailure()
    {
        var threshold = Math.Max(1, _settings.CircuitFailureThreshold);
        var failures = Interlocked.Increment(ref _consecutiveFailures);
        if (failures < threshold)
            return;

        var cooldown = Math.Max(1, _settings.CircuitCooldownSeconds);
        Volatile.Write(ref _circuitOpenUntilTicks, System.Environment.TickCount64 + cooldown * 1000L);
        _logger.LogWarning(
            "Gemini circuit opened for {Cooldown}s after {Failures} consecutive failures; deterministic paths serve requests meanwhile.",
            cooldown,
            failures);
    }

    private void RecordSuccess()
    {
        Volatile.Write(ref _consecutiveFailures, 0);
        Volatile.Write(ref _circuitOpenUntilTicks, 0);
    }

    public async Task<string?> GenerateTextAsync(
        string prompt,
        string language,
        CancellationToken cancellationToken = default)
    {
        if (!IsAvailable)
            return null;

        var userPrompt = GeminiPromptBuilder.BuildUserPrompt(prompt, _settings.MaxContextCharacters);
        if (string.IsNullOrWhiteSpace(userPrompt))
            return null;

        try
        {
            var response = await _client!.Models.GenerateContentAsync(
                GetModel(_settings.GeminiModel),
                userPrompt,
                new GenerateContentConfig
                {
                    SystemInstruction = TextContent(GeminiPromptBuilder.BuildSystemInstruction(
                        language,
                        _settings.MaxContextCharacters)),
                    ThinkingConfig = BuildThinkingConfig(_settings.FastThinkingLevel)
                },
                cancellationToken);

            LogUsage(response, "text");
            var text = ExtractText(response);
            if (string.IsNullOrWhiteSpace(text))
            {
                RecordFailure();
                _logger.LogWarning("Gemini returned an empty text response; falling back to deterministic provider.");
                return null;
            }

            RecordSuccess();
            return text;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            RecordFailure();
            _logger.LogWarning("Gemini text request timed out after {Timeout}s; falling back to deterministic provider.", _settings.TimeoutSeconds);
            return null;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            RecordFailure();
            LogProviderFailure("text", ex);
            return null;
        }
    }

    public async Task<T?> GenerateStructuredAsync<T>(
        string prompt,
        string systemInstruction,
        JsonNode responseSchema,
        CancellationToken cancellationToken = default) where T : class
    {
        if (!IsAvailable)
            return null;

        var userPrompt = GeminiPromptBuilder.BuildUserPrompt(prompt, _settings.MaxContextCharacters);
        if (string.IsNullOrWhiteSpace(userPrompt))
            return null;

        try
        {
            var schema = Schema.FromJson(responseSchema.ToJsonString());
            if (schema is null)
                return null;

            var response = await _client!.Models.GenerateContentAsync(
                GetModel(_settings.GeminiModel),
                userPrompt,
                new GenerateContentConfig
                {
                    SystemInstruction = TextContent(GeminiPromptBuilder.BuildUserPrompt(
                        systemInstruction,
                        _settings.MaxContextCharacters)),
                    ResponseMimeType = "application/json",
                    ResponseSchema = schema,
                    ThinkingConfig = BuildThinkingConfig(_settings.FastThinkingLevel)
                },
                cancellationToken);

            LogUsage(response, "structured");
            var text = ExtractText(response);
            if (string.IsNullOrWhiteSpace(text))
            {
                RecordFailure();
                return null;
            }

            var result = JsonSerializer.Deserialize<T>(text, AppJsonOptions);
            if (result is null)
            {
                RecordFailure();
                return null;
            }

            RecordSuccess();
            return result;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            RecordFailure();
            _logger.LogWarning("Gemini structured request timed out after {Timeout}s; deterministic classifier will be used.", _settings.TimeoutSeconds);
            return null;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            RecordFailure();
            LogProviderFailure("structured", ex);
            return null;
        }
    }

    public Task<GeminiToolTurn?> GenerateToolTurnAsync(
        IReadOnlyList<GeminiConversationMessage> contents,
        string systemInstruction,
        IReadOnlyList<GeminiFunctionDeclaration> functions,
        CancellationToken cancellationToken = default)
        => GenerateToolTurnAsync(contents, systemInstruction, functions, _settings.FastThinkingLevel, cancellationToken);

    public Task<GeminiToolTurn?> GenerateToolTurnWithThinkingAsync(
        IReadOnlyList<GeminiConversationMessage> contents,
        string systemInstruction,
        IReadOnlyList<GeminiFunctionDeclaration> functions,
        string thinkingLevel,
        CancellationToken cancellationToken = default)
        => GenerateToolTurnAsync(contents, systemInstruction, functions, thinkingLevel, cancellationToken);

    public async Task<GeminiToolTurn?> GenerateToolTurnAsync(
        IReadOnlyList<GeminiConversationMessage> contents,
        string systemInstruction,
        IReadOnlyList<GeminiFunctionDeclaration> functions,
        string? thinkingLevel,
        CancellationToken cancellationToken = default)
    {
        if (!IsAvailable)
            return null;

        try
        {
            var safeContents = SanitizeToolContents(contents)
                .Select(ToSdkContent)
                .ToList();
            var sdkFunctions = functions.Take(25).Select(ToSdkFunction).ToList();
            var config = new GenerateContentConfig
            {
                SystemInstruction = TextContent(GeminiPromptBuilder.LimitContext(
                    systemInstruction,
                    _settings.MaxContextCharacters)),
                Tools = sdkFunctions.Count == 0
                    ? null
                    : [new Tool { FunctionDeclarations = sdkFunctions }],
                ToolConfig = sdkFunctions.Count == 0
                    ? null
                    : new ToolConfig
                    {
                        FunctionCallingConfig = new FunctionCallingConfig
                        {
                            Mode = FunctionCallingConfigMode.Auto
                        }
                    },
                ThinkingConfig = BuildThinkingConfig(thinkingLevel)
            };

            var response = await _client!.Models.GenerateContentAsync(
                GetModel(_settings.GeminiModel),
                safeContents,
                config,
                cancellationToken);

            LogUsage(response, "tools");
            var content = response.Candidates?.FirstOrDefault()?.Content;
            if (content?.Parts is null || content.Parts.Count == 0)
            {
                RecordFailure();
                _logger.LogWarning("Gemini returned an empty tool-calling turn; stopping orchestration.");
                return null;
            }

            var text = ExtractText(content);
            var calls = content.Parts
                .Where(part => part.FunctionCall is not null)
                .Select(part => ToApplicationFunctionCall(part.FunctionCall!))
                .Where(call => !string.IsNullOrWhiteSpace(call.Name))
                .ToList();

            if (calls.Count == 0 && string.IsNullOrWhiteSpace(text))
            {
                RecordFailure();
                return null;
            }

            // SDK records carry JsonPropertyName attributes; this preserves the
            // provider JSON fields, including the opaque thoughtSignature bytes.
            var continuation = JsonSerializer.Serialize(content);
            if (continuation.Length > MaxProviderContinuationCharacters)
            {
                RecordFailure();
                _logger.LogWarning("Gemini model continuation exceeded the bounded size; stopping orchestration.");
                return null;
            }

            RecordSuccess();
            return new GeminiToolTurn(text, calls.FirstOrDefault())
            {
                FunctionCalls = calls,
                ProviderContinuation = continuation
            };
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            RecordFailure();
            _logger.LogWarning("Gemini tool-calling request timed out after {Timeout}s; stopping orchestration.", _settings.TimeoutSeconds);
            return null;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            RecordFailure();
            LogProviderFailure("tools", ex);
            return null;
        }
    }

    /// <summary>
    /// Keeps model tool calls adjacent to the matching tool responses and discards
    /// orphaned calls/responses. The protocol pairing includes every call ID when
    /// Google supplied one. Leading complete turns are removed to enforce the bound.
    /// </summary>
    internal static IReadOnlyList<GeminiConversationMessage> SanitizeToolContents(
        IReadOnlyList<GeminiConversationMessage>? contents)
    {
        if (contents is null || contents.Count == 0)
            return [];

        var units = new List<List<GeminiConversationMessage>>();
        for (var i = 0; i < contents.Count; i++)
        {
            var message = contents[i];
            var calls = message.Parts.Where(part => part.FunctionCall is not null)
                .Select(part => part.FunctionCall!).ToList();
            if (calls.Count > 0)
            {
                var next = i + 1 < contents.Count ? contents[i + 1] : null;
                var responses = next?.Parts.Where(part => part.FunctionResponse is not null)
                    .Select(part => part.FunctionResponse!).ToList() ?? [];
                var paired = responses.Count == calls.Count && calls.All(call => responses.Any(result =>
                    string.Equals(call.Name, result.Name, StringComparison.Ordinal)
                    && (string.IsNullOrEmpty(call.Id) || string.Equals(call.Id, result.Id, StringComparison.Ordinal))));
                if (!paired)
                    continue;

                units.Add([message, next!]);
                i++;
                continue;
            }

            if (message.Parts.Any(part => part.FunctionResponse is not null))
                continue;

            units.Add([message]);
        }

        var total = units.Sum(unit => unit.Count);
        var start = 0;
        while (total > MaxToolRequestContents && start < units.Count - 1)
        {
            total -= units[start].Count;
            start++;
        }

        return units.Skip(start).SelectMany(unit => unit).ToList();
    }

    private static GenAiContent ToSdkContent(GeminiConversationMessage message)
    {
        if (!string.IsNullOrWhiteSpace(message.ProviderContinuation))
        {
            return GenAiContent.FromJson(message.ProviderContinuation)
                ?? throw new JsonException("Provider continuation was not a valid model message.");
        }

        var parts = (message.Parts ?? []).Select(part =>
        {
            if (part.FunctionCall is { } call)
            {
                return new GenAiPart
                {
                    FunctionCall = new GenAiFunctionCall
                    {
                        Name = call.Name,
                        Id = call.Id,
                        Args = ToDictionary(call.Arguments)
                    }
                };
            }

            if (part.FunctionResponse is { } result)
            {
                return new GenAiPart
                {
                    FunctionResponse = new GenAiFunctionResponse
                    {
                        Name = result.Name,
                        Id = result.Id,
                        Response = ToDictionary(result.Response)
                    }
                };
            }

            return GenAiPart.FromText(part.Text ?? string.Empty);
        }).ToList();

        var role = message.Role?.Trim().ToLowerInvariant() switch
        {
            "model" or "assistant" => "model",
            _ => "user"
        };
        return new GenAiContent { Role = role, Parts = parts };
    }

    private static GenAiContent TextContent(string text)
        => new() { Parts = [GenAiPart.FromText(text)] };

    private static GenAiFunctionDeclaration ToSdkFunction(GeminiFunctionDeclaration function)
        => new()
        {
            Name = function.Name,
            Description = function.Description,
            Parameters = Schema.FromJson(function.Parameters.ToJsonString())
        };

    private static GeminiFunctionCall ToApplicationFunctionCall(GenAiFunctionCall call)
        => new(
            call.Name?.Trim() ?? string.Empty,
            ToJsonObject(call.Args),
            call.Id);

    private static Dictionary<string, object> ToDictionary(JsonObject value)
        => JsonSerializer.Deserialize<Dictionary<string, object>>(value.ToJsonString(), AppJsonOptions) ?? [];

    private static JsonObject ToJsonObject(Dictionary<string, object>? value)
    {
        if (value is null)
            return new JsonObject();
        return JsonNode.Parse(JsonSerializer.Serialize(value, AppJsonOptions)) as JsonObject ?? new JsonObject();
    }

    private static string? ExtractText(GenerateContentResponse? response)
        => response?.Candidates?.FirstOrDefault()?.Content is { } content ? ExtractText(content) : null;

    private static string? ExtractText(GenAiContent content)
    {
        if (content.Parts is null)
            return null;

        var text = string.Concat(content.Parts
            .Where(part => part.Thought != true)
            .Select(part => part.Text)
            .Where(part => !string.IsNullOrWhiteSpace(part)));
        return string.IsNullOrWhiteSpace(text) ? null : text.Trim();
    }

    private static ThinkingConfig BuildThinkingConfig(string? level)
    {
        var configured = level?.Trim().ToLowerInvariant();
        return new ThinkingConfig
        {
            ThinkingLevel = configured switch
            {
                "medium" => Google.GenAI.Types.ThinkingLevel.Medium,
                "high" => Google.GenAI.Types.ThinkingLevel.High,
                _ => Google.GenAI.Types.ThinkingLevel.Low
            }
        };
    }

    private string GetModel(string? configured)
        => string.IsNullOrWhiteSpace(configured) ? "gemini-3.6-flash" : configured.Trim();

    private static (string BaseUrl, string ApiVersion) GetEndpoint(string? configured)
    {
        var candidate = string.IsNullOrWhiteSpace(configured)
            ? "https://generativelanguage.googleapis.com/v1beta"
            : configured.Trim();
        if (!Uri.TryCreate(candidate, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
        {
            uri = new Uri("https://generativelanguage.googleapis.com/v1beta");
        }

        var version = uri.AbsolutePath.Trim('/');
        return ($"{uri.Scheme}://{uri.Authority}", string.IsNullOrWhiteSpace(version) ? "v1beta" : version);
    }

    private void LogUsage(GenerateContentResponse? response, string operation)
    {
        var usage = response?.UsageMetadata;
        if (usage is null)
            return;

        _logger.LogInformation(
            "Gemini usage: operation={Operation} model={Model} promptTokens={PromptTokens} responseTokens={ResponseTokens} thoughtsTokens={ThoughtTokens} totalTokens={TotalTokens}",
            operation,
            GetModel(_settings.GeminiModel),
            usage.PromptTokenCount,
            usage.CandidatesTokenCount,
            usage.ThoughtsTokenCount,
            usage.TotalTokenCount);
    }

    private void LogProviderFailure(string operation, Exception exception)
    {
        _logger.LogWarning(
            "Gemini {Operation} request failed with SDK error class {ErrorClass}; falling back to deterministic handling.",
            operation,
            exception.GetType().Name);
    }

    public void Dispose() => _client?.Dispose();
}
