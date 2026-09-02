using System.Text.Json.Nodes;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Sends a single natural-language prompt to Google Gemini and returns the
/// generated text or structured data. Implementations must be resilient: any
/// failure (HTTP error, timeout, malformed/empty response, cancellation, missing
/// configuration) must surface as a recoverable signal (null) so callers can fall
/// back to the deterministic provider. The implementation must never expose, log,
/// or return the API key.
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

    /// <summary>
    /// Requests true structured output using Gemini's native <c>responseSchema</c>
    /// (responseMimeType = "application/json"). Returns the deserialized payload,
    /// or null when Gemini is unavailable, rejected the schema, timed out, or
    /// returned text that is not valid JSON (callers then fall back to a
    /// deterministic classifier). The schema must be an OpenAPI-compatible
    /// <see cref="JsonNode"/>. Callers remain responsible for semantically
    /// validating the returned values.
    /// </summary>
    Task<T?> GenerateStructuredAsync<T>(
        string prompt,
        string systemInstruction,
        JsonNode responseSchema,
        CancellationToken cancellationToken = default) where T : class;
}
