using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>
/// Communicates with the Google Gemini REST API using an HttpClient obtained
/// from <see cref="IHttpClientFactory"/>. Each logical user request is attempted
/// at most twice, strictly in order: the primary key/model first, then — only if a
/// recoverable failure occurs and a secondary key is configured — the secondary
/// key/model. All HTTP/timeout/JSON failure modes are converted to a null result
/// (recoverable) with diagnostic logging that never includes the API key. Permanent
/// failures (HTTP 400) and caller cancellation are never duplicated on the
/// secondary key. The API key is sent in the "x-goog-api-key" request header rather
/// than as a URL query parameter, so it never appears in access logs, proxies, or
/// the request line, and is never logged or returned. User/context input is
/// truncated to <see cref="GoogleAiSettings.MaxContextCharacters"/> before being
/// sent, so a maliciously large request cannot consume unbounded Gemini quota.
/// </summary>
public sealed class GeminiService : IGeminiService
{
    public const string HttpClientName = "gemini";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

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
        => _settings.Enabled && !string.IsNullOrWhiteSpace(_settings.ApiKey);

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

        // Enforce the context limit before the prompt leaves the server.
        var userPrompt = GeminiPromptBuilder.BuildUserPrompt(prompt, _settings.MaxContextCharacters);
        if (string.IsNullOrWhiteSpace(userPrompt))
        {
            _logger.LogInformation("Gemini prompt is empty after context limiting; skipping Gemini request.");
            return null;
        }

        var systemInstruction = GeminiPromptBuilder.BuildSystemInstruction(language, _settings.MaxContextCharacters);

        // Primary attempt: primary key + primary model.
        var primary = await TryTextAttemptAsync(
            _settings.ApiKey,
            GetModel(_settings.GeminiModel),
            userPrompt,
            systemInstruction,
            null,
            "primary",
            cancellationToken);

        if (primary.Value is not null)
        {
            return primary.Value;
        }

        // Recoverable failure (5xx/429/401/403/network/timeout/invalid output): try secondary key/model.
        if (primary.ShouldFailOver && HasSecondaryKey && !cancellationToken.IsCancellationRequested)
        {
            _logger.LogInformation("Primary Gemini key failed; attempting failover with the secondary key.");
            var secondary = await TryTextAttemptAsync(
                _settings.ApiKey2,
                GetModel(_settings.GeminiModel2),
                userPrompt,
                systemInstruction,
                null,
                "secondary",
                cancellationToken);

            return secondary.Value;
        }

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

        // Enforce the context limit before the prompt leaves the server.
        var userPrompt = GeminiPromptBuilder.BuildUserPrompt(prompt, _settings.MaxContextCharacters);
        if (string.IsNullOrWhiteSpace(userPrompt))
        {
            _logger.LogInformation("Gemini prompt is empty after context limiting; skipping structured request.");
            return null;
        }

        // Primary attempt: primary key + primary model.
        var primary = await TryStructuredAttemptAsync<T>(
            _settings.ApiKey,
            GetModel(_settings.GeminiModel),
            userPrompt,
            systemInstruction,
            responseSchema,
            "primary",
            cancellationToken);

        if (primary.Value is not null)
        {
            return primary.Value;
        }

        // Recoverable failure (5xx/429/401/403/network/timeout/invalid output): try secondary key/model.
        if (primary.ShouldFailOver && HasSecondaryKey && !cancellationToken.IsCancellationRequested)
        {
            _logger.LogInformation("Primary Gemini key failed; attempting failover with the secondary key.");
            var secondary = await TryStructuredAttemptAsync<T>(
                _settings.ApiKey2,
                GetModel(_settings.GeminiModel2),
                userPrompt,
                systemInstruction,
                responseSchema,
                "secondary",
                cancellationToken);

            return secondary.Value;
        }

        return null;
    }

    private bool HasSecondaryKey
        => _settings.Enabled && !string.IsNullOrWhiteSpace(_settings.ApiKey2);

    private async Task<AttemptResult<string?>> TryTextAttemptAsync(
        string apiKey,
        string model,
        string userPrompt,
        string systemInstruction,
        JsonNode? responseSchema,
        string keyLabel,
        CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient(HttpClientName);
        var url = $"{GetBaseUrl()}/models/{Uri.EscapeDataString(model)}:generateContent";
        var body = new GeminiGenerateContentRequest(
            [new GeminiContent([new GeminiPart(userPrompt)])],
            new GeminiContent([new GeminiPart(systemInstruction)]),
            new GeminiGenerationConfig());

        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(body, options: JsonOptions)
        };
        request.Headers.TryAddWithoutValidation("x-goog-api-key", apiKey);

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
                    "Gemini {Key} request failed with HTTP {Status}; falling back to deterministic provider.",
                    keyLabel, status);
                return new AttemptResult<string?>(IsRecoverableStatus(response.StatusCode), null);
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
                _logger.LogWarning("Gemini {Key} returned malformed JSON; falling back to deterministic provider.", keyLabel);
                return new AttemptResult<string?>(true, null);
            }

            var text = ExtractText(parsed);
            if (string.IsNullOrWhiteSpace(text))
            {
                _logger.LogWarning("Gemini {Key} returned an empty response; falling back to deterministic provider.", keyLabel);
                return new AttemptResult<string?>(true, null);
            }

            return new AttemptResult<string?>(false, text);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            // The HttpClient's internal timeout fired (client cancellation) rather than
            // the caller cancelling the operation.
            _logger.LogWarning("Gemini {Key} request timed out after {Timeout}s; falling back to deterministic provider.", keyLabel, _settings.TimeoutSeconds);
            return new AttemptResult<string?>(true, null);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (HttpRequestException)
        {
            _logger.LogWarning("Gemini {Key} request failed due to a network error; falling back to deterministic provider.", keyLabel);
            return new AttemptResult<string?>(true, null);
        }
        catch (JsonException)
        {
            _logger.LogWarning("Gemini {Key} request/response serialization failed; falling back to deterministic provider.", keyLabel);
            return new AttemptResult<string?>(true, null);
        }
    }

    private async Task<AttemptResult<T?>> TryStructuredAttemptAsync<T>(
        string apiKey,
        string model,
        string userPrompt,
        string systemInstruction,
        JsonNode responseSchema,
        string keyLabel,
        CancellationToken cancellationToken) where T : class
    {
        var client = _httpClientFactory.CreateClient(HttpClientName);
        var url = $"{GetBaseUrl()}/models/{Uri.EscapeDataString(model)}:generateContent";
        var body = new GeminiGenerateContentRequest(
            [new GeminiContent([new GeminiPart(userPrompt)])],
            new GeminiContent([new GeminiPart(systemInstruction)]),
            new GeminiGenerationConfig("application/json", responseSchema));

        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(body, options: JsonOptions)
        };
        request.Headers.TryAddWithoutValidation("x-goog-api-key", apiKey);

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
                    "Gemini {Key} structured request failed with HTTP {Status}; falling back to deterministic classifier.",
                    keyLabel, status);
                return new AttemptResult<T?>(IsRecoverableStatus(response.StatusCode), null);
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
                _logger.LogWarning("Gemini {Key} returned malformed JSON; falling back to deterministic classifier.", keyLabel);
                return new AttemptResult<T?>(true, null);
            }

            var text = ExtractText(parsed);
            if (string.IsNullOrWhiteSpace(text))
            {
                _logger.LogWarning("Gemini {Key} returned an empty structured response; falling back to deterministic classifier.", keyLabel);
                return new AttemptResult<T?>(true, null);
            }

            try
            {
                var deserialized = JsonSerializer.Deserialize<T>(text, JsonOptions);
                return new AttemptResult<T?>(true, deserialized);
            }
            catch (JsonException)
            {
                _logger.LogWarning("Gemini {Key} structured output was not valid JSON; falling back to deterministic classifier.", keyLabel);
                return new AttemptResult<T?>(true, null);
            }
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("Gemini {Key} structured request timed out after {Timeout}s; falling back to deterministic classifier.", keyLabel, _settings.TimeoutSeconds);
            return new AttemptResult<T?>(true, null);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (HttpRequestException)
        {
            _logger.LogWarning("Gemini {Key} structured request failed due to a network error; falling back to deterministic classifier.", keyLabel);
            return new AttemptResult<T?>(true, null);
        }
        catch (JsonException)
        {
            _logger.LogWarning("Gemini {Key} structured request/response serialization failed; falling back to deterministic classifier.", keyLabel);
            return new AttemptResult<T?>(true, null);
        }
    }

    /// <summary>
    /// Returns true for statuses where retrying against the (possibly valid) secondary
    /// key is worthwhile, and false for permanent failures (4xx other than 401/403/429)
    /// where the request must not be duplicated.
    /// </summary>
    private static bool IsRecoverableStatus(HttpStatusCode status)
        => status is HttpStatusCode.Unauthorized
            or HttpStatusCode.Forbidden
            or HttpStatusCode.TooManyRequests
            or HttpStatusCode.InternalServerError
            or HttpStatusCode.BadGateway
            or HttpStatusCode.ServiceUnavailable
            or HttpStatusCode.GatewayTimeout
            || (int)status >= 500;

    private string GetModel(string configured)
        => string.IsNullOrWhiteSpace(configured) ? "gemini-3.6-flash" : configured;

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
        [property: JsonPropertyName("content")] GeminiContent? Content);

    /// <summary>
    /// Outcome of a single Gemini attempt. <see cref="Value"/> is the successful
    /// result when present. <see cref="ShouldFailOver"/> is true when the failure is
    /// recoverable (so a secondary key may be tried) and false for permanent failures
    /// or cancellation where the request must not be duplicated.
    /// </summary>
    private readonly record struct AttemptResult<T>(bool ShouldFailOver, T Value);
}
