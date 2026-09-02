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

    /// <summary>Optional secondary Gemini API key used only for failover on recoverable failures.</summary>
    public string ApiKey2 { get; set; } = string.Empty;

    /// <summary>Gemini model identifier (e.g. a supported Gemini Flash model).</summary>
    public string GeminiModel { get; set; } = "gemini-3.6-flash";

    /// <summary>Optional secondary Gemini model used only for failover.</summary>
    public string GeminiModel2 { get; set; } = "gemini-3.6-flash";

    /// <summary>Base URL of the Gemini REST API (without model or key).</summary>
    public string BaseUrl { get; set; } = "https://generativelanguage.googleapis.com/v1beta";

    /// <summary>Whether the Gemini integration is enabled.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Maximum characters of user content to send to Gemini.</summary>
    public int MaxContextCharacters { get; set; } = 2000;

    /// <summary>Request timeout for Gemini HTTP calls, in seconds. Kept below the
    /// frontend's 25s request timeout so a slow Gemini call falls back to the
    /// deterministic provider before the client aborts the request.</summary>
    public int TimeoutSeconds { get; set; } = 15;
}
