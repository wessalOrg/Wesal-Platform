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
/// The API key is read only from configuration and never committed,
/// logged, or exposed to the frontend.
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

    /// <summary>Request timeout for Gemini HTTP calls, in seconds.</summary>
    public int TimeoutSeconds { get; set; } = 30;
}
