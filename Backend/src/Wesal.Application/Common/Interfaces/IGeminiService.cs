namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Sends a single natural-language prompt to Google Gemini and returns the
/// generated text. Implementations must be resilient: any failure (HTTP error,
/// timeout, malformed/empty response, cancellation, missing configuration)
/// must surface as a recoverable signal so callers can fall back to the
/// deterministic provider. The implementation must never expose, log, or
/// return the API key.
/// </summary>
public interface IGeminiService
{
    /// <summary>
    /// Returns true when Gemini is available to be attempted: enabled in
    /// configuration AND an API key is present.
    /// </summary>
    bool IsAvailable { get; }

    /// <summary>
    /// Sends the given prompt (already assembled by a prompt builder) to Gemini.
    /// Returns the generated text, or null when the response was empty/invalid
    /// or could not be retrieved (which callers treat as "fall back to the
    /// deterministic provider").
    /// </summary>
    Task<string?> GenerateTextAsync(string prompt, string language, CancellationToken cancellationToken = default);
}
