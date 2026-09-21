using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>
/// Communicates with the Google Gemini REST API using an HttpClient obtained
/// from <see cref="IHttpClientFactory"/>. Each request uses a single configured
/// API key and model. All HTTP/timeout/JSON failure modes are converted to a null
/// result (recoverable) with diagnostic logging that never includes the API key.
/// A circuit breaker opens for <see cref="CircuitBreakerCooldownSeconds"/> seconds
/// after any failure, causing <see cref="IsAvailable"/> to return false so
/// upstream consumers (e.g. <see cref="GeminiAiIntentExtractor"/>) fall back to
/// deterministic classification without making another HTTP call. The API key is
/// sent in the "x-goog-api-key" request header rather than as a URL query
/// parameter, so it never appears in access logs, proxies, or the request line,
/// and is never logged or returned. User/context input is truncated to
/// <see cref="GoogleAiSettings.MaxContextCharacters"/> before being sent, so a
/// maliciously large request cannot consume unbounded Gemini quota.
/// </summary>
public sealed class GeminiService : IGeminiService, IGeminiToolCallService
{
    public const string HttpClientName = "gemini";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private const int CircuitBreakerCooldownSeconds = 60;
    private static long _circuitOpenUntilUtcTicks;

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly GoogleAiSettings _settings;
    private readonly ILogger<GeminiService> _logger;

    public GeminiService(
        IHttpClientFactory httpClientFactory,
        IOptions<GoogleAiSettings> settings,
        ILogger<GeminiService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _settings = settings.Value;
        _logger = logger;
    }

    public bool IsAvailable
    {
        get
        {
            if (!_settings.Enabled || string.IsNullOrWhiteSpace(_settings.ApiKey))
                return false;
            var until = Volatile.Read(ref _circuitOpenUntilUtcTicks);
            if (until > 0 && Environment.TickCount64 < until)
                return false;
            if (until > 0)
                Volatile.Write(ref _circuitOpenUntilUtcTicks, 0);
            return true;
        }
    }

    private static void RecordFailure()
    {
        var until = Environment.TickCount64 + CircuitBreakerCooldownSeconds * 1000L;
        Volatile.Write(ref _circuitOpenUntilUtcTicks, until);
    }

    private static void RecordSuccess()
    {
        Volatile.Write(ref _circuitOpenUntilUtcTicks, 0);
    }

    internal static void ResetCircuitBreaker()
    {
        Volatile.Write(ref _circuitOpenUntilUtcTicks, 0);
    }

    public async Task<string?> GenerateTextAsync(
        string prompt,
        string language,
        CancellationToken cancellationToken = default)
    {
        if (!IsAvailable)
        {
            _logger.LogInformation(
                "Gemini is not available (disabled or missing API key); skipping Gemini request.");
            return null;
        }

        var userPrompt = GeminiPromptBuilder.BuildUserPrompt(prompt, _settings.MaxContextCharacters);
        if (string.IsNullOrWhiteSpace(userPrompt))
        {
            _logger.LogInformation("Gemini prompt is empty after context limiting; skipping Gemini request.");
            return null;
        }

        var systemInstruction = GeminiPromptBuilder.BuildSystemInstruction(language, _settings.MaxContextCharacters);

        var result = await TryTextAttemptAsync(
            userPrompt,
            systemInstruction,
            cancellationToken);

        if (result is not null)
        {
            RecordSuccess();
            return result;
        }

        RecordFailure();
        return null;
    }

    public async Task<T?> GenerateStructuredAsync<T>(
        string prompt,
        string systemInstruction,
        JsonNode responseSchema,
        CancellationToken cancellationToken = default) where T : class
    {
        if (!IsAvailable)
        {
            _logger.LogInformation(
                "Gemini is not available (disabled or missing API key); skipping structured request.");
            return null;
        }

        var userPrompt = GeminiPromptBuilder.BuildUserPrompt(prompt, _settings.MaxContextCharacters);
        if (string.IsNullOrWhiteSpace(userPrompt))
        {
            _logger.LogInformation("Gemini prompt is empty after context limiting; skipping structured request.");
            return null;
        }

        var result = await TryStructuredAttemptAsync<T>(
            userPrompt,
            systemInstruction,
            responseSchema,
            cancellationToken);

        if (result is not null)
        {
            RecordSuccess();
            return result;
        }

        RecordFailure();
        return null;
    }

    public async Task<GeminiToolTurn?> GenerateToolTurnAsync(
        IReadOnlyList<GeminiConversationMessage> contents,
        string systemInstruction,
        IReadOnlyList<GeminiFunctionDeclaration> functions,
        CancellationToken cancellationToken = default)
    {
        if (!IsAvailable)
        {
            _logger.LogInformation(
                "Gemini is not available (disabled or missing API key); skipping tool-calling request.");
            return null;
        }

        var result = await TryToolTurnAttemptAsync(
            contents,
            systemInstruction,
            functions,
            cancellationToken);

        if (result is not null)
        {
            RecordSuccess();
            return result;
        }

        RecordFailure();
        return null;
    }

    private async Task<GeminiToolTurn?> TryToolTurnAttemptAsync(
        IReadOnlyList<GeminiConversationMessage> contents,
        string systemInstruction,
        IReadOnlyList<GeminiFunctionDeclaration> functions,
        CancellationToken cancellationToken)
    {
        var safeContents = contents is null || contents.Count == 0
            ? []
            : contents.Take(7).Select(ToWireMessage).ToList();

        var safeFunctions = functions is null
            ? []
            : functions.Take(25).Select(f => new GeminiWireFunctionDeclaration(
                f.Name,
                f.Description ?? string.Empty,
                f.Parameters ?? new JsonObject())).ToList();

        var client = _httpClientFactory.CreateClient(HttpClientName);
        var model = GetModel(_settings.GeminiModel);
        var url = $"{GetBaseUrl()}/models/{Uri.EscapeDataString(model)}:generateContent";
        var body = new GeminiToolCallRequest(
            safeContents,
            new GeminiContent([new GeminiPart(systemInstruction)]),
            safeFunctions.Count == 0 ? null : [new GeminiWireTools(safeFunctions)],
            safeFunctions.Count == 0 ? null : new GeminiToolConfig(new GeminiWireFunctionCallingConfig("AUTO")),
            new GeminiGenerationConfig());

        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(body, options: JsonOptions)
        };
        request.Headers.TryAddWithoutValidation("x-goog-api-key", _settings.ApiKey);

        try
        {
            using var response = await client.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var status = (int)response.StatusCode;
                _logger.LogWarning(
                    "Gemini tool-calling request failed with HTTP {Status}; stopping tool orchestration.",
                    status);
                return null;
            }

            GeminiGenerateContentResponse? parsed;
            try
            {
                await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
                parsed = await JsonSerializer.DeserializeAsync<GeminiGenerateContentResponse>(
                    stream,
                    JsonOptions,
                    cancellationToken);
            }
            catch (JsonException)
            {
                _logger.LogWarning("Gemini returned malformed JSON for tool-calling; stopping tool orchestration.");
                return null;
            }

            var turn = ExtractToolTurn(parsed);
            if (turn is null || (!turn.HasText && !turn.HasFunctionCall))
            {
                _logger.LogWarning("Gemini returned an empty tool-calling turn; stopping tool orchestration.");
                return null;
            }

            return turn;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("Gemini tool-calling request timed out after {Timeout}s; stopping tool orchestration.", _settings.TimeoutSeconds);
            return null;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (HttpRequestException)
        {
            _logger.LogWarning("Gemini tool-calling request failed due to a network error; stopping tool orchestration.");
            return null;
        }
        catch (JsonException)
        {
            _logger.LogWarning("Gemini tool-calling request/response serialization failed; stopping tool orchestration.");
            return null;
        }
    }

    private static GeminiWireMessage ToWireMessage(GeminiConversationMessage message)
    {
        var parts = (message.Parts ?? []).Select(p => new GeminiWirePart(
                p.Text,
                p.FunctionCall is null
                    ? null
                    : new GeminiWireFunctionCall(p.FunctionCall.Name, p.FunctionCall.Arguments ?? new JsonObject()),
                p.FunctionResponse is null
                    ? null
                    : new GeminiWireFunctionResponse(p.FunctionResponse.Name, p.FunctionResponse.Response)))
            .ToList();

        var role = message.Role?.Trim().ToLowerInvariant();
        var normalizedRole = role switch
        {
            "user" or "model" or "function" => role,
            _ => "user"
        };

        return new GeminiWireMessage(normalizedRole, parts);
    }

    private static GeminiToolTurn? ExtractToolTurn(GeminiGenerateContentResponse? response)
    {
        if (response?.Candidates is null || response.Candidates.Count == 0)
        {
            return null;
        }

        var candidate = response.Candidates[0];
        if (candidate?.Content?.Parts is null)
        {
            return null;
        }

        var textBuilder = new StringBuilder();
        GeminiFunctionCall? functionCall = null;

        foreach (var part in candidate.Content.Parts)
        {
            if (!string.IsNullOrWhiteSpace(part?.Text))
            {
                textBuilder.Append(part.Text);
            }

            if (part?.FunctionCall is not null && functionCall is null)
            {
                var name = part.FunctionCall.Name?.Trim();
                var arguments = part.FunctionCall.Args ?? new JsonObject();
                if (!string.IsNullOrWhiteSpace(name))
                {
                    functionCall = new GeminiFunctionCall(name, arguments);
                }
            }
        }

        var text = textBuilder.Length == 0 ? null : textBuilder.ToString().Trim();
        if (functionCall is null && string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        return new GeminiToolTurn(text, functionCall);
    }

    private async Task<string?> TryTextAttemptAsync(
        string userPrompt,
        string systemInstruction,
        CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient(HttpClientName);
        var model = GetModel(_settings.GeminiModel);
        var url = $"{GetBaseUrl()}/models/{Uri.EscapeDataString(model)}:generateContent";
        var body = new GeminiGenerateContentRequest(
            [new GeminiContent([new GeminiPart(userPrompt)])],
            new GeminiContent([new GeminiPart(systemInstruction)]),
            new GeminiGenerationConfig());

        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(body, options: JsonOptions)
        };
        request.Headers.TryAddWithoutValidation("x-goog-api-key", _settings.ApiKey);

        try
        {
            using var response = await client.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var status = (int)response.StatusCode;
                _logger.LogWarning(
                    "Gemini request failed with HTTP {Status}; falling back to deterministic provider.",
                    status);
                return null;
            }

            GeminiGenerateContentResponse? parsed;
            try
            {
                await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
                parsed = await JsonSerializer.DeserializeAsync<GeminiGenerateContentResponse>(
                    stream,
                    JsonOptions,
                    cancellationToken);
            }
            catch (JsonException)
            {
                _logger.LogWarning("Gemini returned malformed JSON; falling back to deterministic provider.");
                return null;
            }

            var text = ExtractText(parsed);
            if (string.IsNullOrWhiteSpace(text))
            {
                _logger.LogWarning("Gemini returned an empty response; falling back to deterministic provider.");
                return null;
            }

            return text;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("Gemini request timed out after {Timeout}s; falling back to deterministic provider.", _settings.TimeoutSeconds);
            return null;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (HttpRequestException)
        {
            _logger.LogWarning("Gemini request failed due to a network error; falling back to deterministic provider.");
            return null;
        }
        catch (JsonException)
        {
            _logger.LogWarning("Gemini request/response serialization failed; falling back to deterministic provider.");
            return null;
        }
    }

    private async Task<T?> TryStructuredAttemptAsync<T>(
        string userPrompt,
        string systemInstruction,
        JsonNode responseSchema,
        CancellationToken cancellationToken) where T : class
    {
        var client = _httpClientFactory.CreateClient(HttpClientName);
        var model = GetModel(_settings.GeminiModel);
        var url = $"{GetBaseUrl()}/models/{Uri.EscapeDataString(model)}:generateContent";
        var body = new GeminiGenerateContentRequest(
            [new GeminiContent([new GeminiPart(userPrompt)])],
            new GeminiContent([new GeminiPart(systemInstruction)]),
            new GeminiGenerationConfig("application/json", responseSchema));

        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(body, options: JsonOptions)
        };
        request.Headers.TryAddWithoutValidation("x-goog-api-key", _settings.ApiKey);

        try
        {
            using var response = await client.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var status = (int)response.StatusCode;
                _logger.LogWarning(
                    "Gemini structured request failed with HTTP {Status}; falling back to deterministic classifier.",
                    status);
                return null;
            }

            GeminiGenerateContentResponse? parsed;
            try
            {
                await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
                parsed = await JsonSerializer.DeserializeAsync<GeminiGenerateContentResponse>(
                    stream,
                    JsonOptions,
                    cancellationToken);
            }
            catch (JsonException)
            {
                _logger.LogWarning("Gemini returned malformed JSON; falling back to deterministic classifier.");
                return null;
            }

            var text = ExtractText(parsed);
            if (string.IsNullOrWhiteSpace(text))
            {
                _logger.LogWarning("Gemini returned an empty structured response; falling back to deterministic classifier.");
                return null;
            }

            try
            {
                var deserialized = JsonSerializer.Deserialize<T>(text, JsonOptions);
                return deserialized;
            }
            catch (JsonException)
            {
                _logger.LogWarning("Gemini structured output was not valid JSON; falling back to deterministic classifier.");
                return null;
            }
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("Gemini structured request timed out after {Timeout}s; falling back to deterministic classifier.", _settings.TimeoutSeconds);
            return null;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (HttpRequestException)
        {
            _logger.LogWarning("Gemini structured request failed due to a network error; falling back to deterministic classifier.");
            return null;
        }
        catch (JsonException)
        {
            _logger.LogWarning("Gemini structured request/response serialization failed; falling back to deterministic classifier.");
            return null;
        }
    }

    private string GetModel(string configured)
        => string.IsNullOrWhiteSpace(configured) ? "gemini-3.6-flash" : configured.Trim();

    private string GetBaseUrl()
        => string.IsNullOrWhiteSpace(_settings.BaseUrl)
            ? "https://generativelanguage.googleapis.com/v1beta"
            : _settings.BaseUrl.TrimEnd('/');

    private static string? ExtractText(GeminiGenerateContentResponse? response)
    {
        if (response?.Candidates is null || response.Candidates.Count == 0)
        {
            return null;
        }

        var candidate = response.Candidates[0];
        if (candidate?.Content?.Parts is null)
        {
            return null;
        }

        var builder = new StringBuilder();
        foreach (var part in candidate.Content.Parts)
        {
            if (!string.IsNullOrWhiteSpace(part?.Text))
            {
                builder.Append(part.Text);
            }
        }

        return builder.Length == 0 ? null : builder.ToString().Trim();
    }

    private sealed record GeminiGenerateContentRequest(
        IReadOnlyList<GeminiContent> Contents,
        GeminiContent SystemInstruction,
        GeminiGenerationConfig GenerationConfig);

    private sealed record GeminiContent(IReadOnlyList<GeminiPart> Parts);

    private sealed record GeminiPart(string? Text);

    private sealed record GeminiGenerationConfig(
        string? ResponseMimeType = null,
        JsonNode? ResponseSchema = null);

    private sealed record GeminiGenerateContentResponse(
        IReadOnlyList<GeminiCandidate>? Candidates);

    private sealed record GeminiCandidate(
        [property: JsonPropertyName("content")] GeminiResponseContent? Content);

    private sealed record GeminiResponseContent(IReadOnlyList<GeminiWirePart> Parts);

    private sealed record GeminiToolCallRequest(
        IReadOnlyList<GeminiWireMessage> Contents,
        GeminiContent SystemInstruction,
        IReadOnlyList<GeminiWireTools>? Tools,
        GeminiToolConfig? ToolConfig,
        GeminiGenerationConfig GenerationConfig);

    private sealed record GeminiWireMessage(
        string Role,
        IReadOnlyList<GeminiWirePart> Parts);

    private sealed record GeminiWirePart(
        [property: JsonPropertyName("text")] string? Text = null,
        [property: JsonPropertyName("functionCall")] GeminiWireFunctionCall? FunctionCall = null,
        [property: JsonPropertyName("functionResponse")] GeminiWireFunctionResponse? FunctionResponse = null);

    private sealed record GeminiWireFunctionCall(
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("args")] JsonObject Args);

    private sealed record GeminiWireFunctionResponse(
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("response")] JsonObject Response);

    private sealed record GeminiWireTools(
        [property: JsonPropertyName("functionDeclarations")] IReadOnlyList<GeminiWireFunctionDeclaration> FunctionDeclarations);

    private sealed record GeminiWireFunctionDeclaration(
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("description")] string Description,
        [property: JsonPropertyName("parameters")] JsonObject Parameters);

    private sealed record GeminiToolConfig(
        [property: JsonPropertyName("functionCallingConfig")] GeminiWireFunctionCallingConfig FunctionCallingConfig);

    private sealed record GeminiWireFunctionCallingConfig(
        [property: JsonPropertyName("mode")] string Mode);
}
