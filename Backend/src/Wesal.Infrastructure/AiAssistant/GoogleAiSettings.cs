using Microsoft.Extensions.Configuration;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>
/// Strongly typed configuration for the Google Gemini integration.
/// Bound from the "GoogleAI" configuration section.
///
/// Production / Render environment variables (ASP.NET Core "__" -> ":"):
///   GoogleAI__ApiKey      -> GoogleAI:ApiKey
///   GoogleAI__GeminiModel -> GoogleAI:GeminiModel
///   GoogleAI__Enabled     -> GoogleAI:Enabled
///   GoogleAI__BaseUrl     -> GoogleAI:BaseUrl
///   GoogleAI__MaxContextCharacters -> GoogleAI:MaxContextCharacters
///   GoogleAI__TimeoutSeconds       -> GoogleAI:TimeoutSeconds
///
/// Optionally a secondary key/model can be configured for failover resilience:
///   GoogleAI__ApiKey_2      -> GoogleAI:ApiKey_2
///   GoogleAI__GeminiModel_2 -> GoogleAI:GeminiModel_2
///
/// The secondary key is only used when the primary key fails on a recoverable
/// condition (429/5xx, timeout, network error, invalid/empty output). Two keys on
/// the same Google Cloud project share the same quota, so this provides resilience
/// only, not additional quota. The API keys are read only from configuration and
/// never committed, logged, or exposed to the frontend.
/// </summary>
public sealed class GoogleAiSettings
{
    public const string SectionName = "GoogleAI";

    /// <summary>Google AI Studio / Gemini API key. Server-side only.</summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>Optional secondary Gemini API key used only for failover on recoverable failures.
    /// Bound from <c>GoogleAI:ApiKey_2</c> (env <c>GoogleAI__ApiKey_2</c>).</summary>
    [ConfigurationKeyName("ApiKey_2")]
    public string ApiKey2 { get; set; } = string.Empty;

    /// <summary>Gemini model identifier (e.g. a supported Gemini Flash model).</summary>
    public string GeminiModel { get; set; } = "gemini-3.6-flash";

    /// <summary>Optional secondary Gemini model used only for failover.
    /// Bound from <c>GoogleAI:GeminiModel_2</c> (env <c>GoogleAI__GeminiModel_2</c>).</summary>
    [ConfigurationKeyName("GeminiModel_2")]
    public string GeminiModel2 { get; set; } = "gemini-3.6-flash";

    /// <summary>Base URL of the Gemini REST API (without model or key).</summary>
    public string BaseUrl { get; set; } = "https://generativelanguage.googleapis.com/v1beta";

    /// <summary>Whether the Gemini integration is enabled.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Maximum characters of user content to send to Gemini.</summary>
    public int MaxContextCharacters { get; set; } = 2000;

    /// <summary>Request timeout for a single Gemini HTTP call, in seconds. Must stay
    /// well below the frontend's 25 s request budget because a single /assistant
    /// turn can issue up to two Gemini calls (structured intent + HowTo text),
    /// each with an optional secondary-key failover — worst-case 4 sequential
    /// HTTP attempts. At 8 s the worst case is 32 s, but the circuit breaker
    /// (after the first failure) short-circuits the remaining calls so the
    /// actual latency is ~8-16 s.</summary>
    public int TimeoutSeconds { get; set; } = 8;
}
