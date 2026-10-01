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
/// The API key is read only from configuration and never committed, logged,
/// or exposed to the frontend.
/// </summary>
public sealed class GoogleAiSettings
{
    public const string SectionName = "GoogleAI";

    /// <summary>Google AI Studio / Gemini API key. Server-side only.</summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>Gemini model identifier (e.g. a supported Gemini Flash model).</summary>
    public string GeminiModel { get; set; } = "gemini-3.6-flash";

    /// <summary>Base URL of the Gemini REST API (without model or key).</summary>
    public string BaseUrl { get; set; } = "https://generativelanguage.googleapis.com/v1beta";

    /// <summary>Whether the Gemini integration is enabled.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Maximum characters of user content to send to Gemini.</summary>
    public int MaxContextCharacters { get; set; } = 2000;

    /// <summary>Timeout for a single Gemini HTTP call, in seconds. The default leaves
    /// headroom for current Flash models, which routinely need several seconds.</summary>
    public int TimeoutSeconds { get; set; } = 10;

    /// <summary>Wall-clock budget for one whole assistant turn's Gemini work (all tool
    /// rounds together). When it is exhausted the turn degrades to the deterministic
    /// path instead of making the user wait. Must stay below the frontend's 25 s budget.</summary>
    public int TotalBudgetSeconds { get; set; } = 15;

    /// <summary>Consecutive Gemini failures before the (per-process) breaker opens.
    /// A single slow or failed request must not disable Gemini for everyone.</summary>
    public int CircuitFailureThreshold { get; set; } = 3;

    /// <summary>How long the breaker stays open once tripped, in seconds.</summary>
    public int CircuitCooldownSeconds { get; set; } = 30;

    /// <summary>IANA time zone used to resolve "today" / "tomorrow" / weekdays for
    /// availability questions.</summary>
    public string TimeZoneId { get; set; } = "Asia/Gaza";
}
