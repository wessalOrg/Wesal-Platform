using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>
/// Communicates with the Google Gemini REST API using an HttpClient obtained
/// from <see cref="IHttpClientFactory"/>. All HTTP/timeout/JSON failure modes are
/// converted to a null result (recoverable) with diagnostic logging that never
/// includes the API key. The API key is injected only as a query parameter on the
/// outgoing request and is never logged or returned. User/context input is
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

        var model = string.IsNullOrWhiteSpace(_settings.GeminiModel) ? "gemini-3.6-flash" : _settings.GeminiModel;
        var baseUrl = string.IsNullOrWhiteSpace(_settings.BaseUrl)
            ? "https://generativelanguage.googleapis.com/v1beta"
            : _settings.BaseUrl.TrimEnd('/');

        // Enforce the context limit before the prompt leaves the server.
        var userPrompt = GeminiPromptBuilder.BuildUserPrompt(prompt, _settings.MaxContextCharacters);
        if (string.IsNullOrWhiteSpace(userPrompt))
        {
            _logger.LogInformation("Gemini prompt is empty after context limiting; skipping Gemini request.");
            return null;
        }

        var systemInstruction = GeminiPromptBuilder.BuildSystemInstruction(language, _settings.MaxContextCharacters);

        var client = _httpClientFactory.CreateClient(HttpClientName);

        var url = $"{baseUrl}/models/{Uri.EscapeDataString(model)}:generateContent?key={Uri.EscapeDataString(_settings.ApiKey)}";
        var body = new GeminiGenerateContentRequest(
            [new GeminiContent([new GeminiPart(userPrompt)])],
            new GeminiContent([new GeminiPart(systemInstruction)]),
            new GeminiGenerationConfig());

        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(body, options: JsonOptions)
        };

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
            // The HttpClient's internal timeout fired (client cancellation) rather than
            // the caller cancelling the operation.
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

    private sealed record GeminiGenerationConfig();

    private sealed record GeminiGenerateContentResponse(
        IReadOnlyList<GeminiCandidate>? Candidates);

    private sealed record GeminiCandidate(
        [property: JsonPropertyName("content")] GeminiContent? Content);
}
