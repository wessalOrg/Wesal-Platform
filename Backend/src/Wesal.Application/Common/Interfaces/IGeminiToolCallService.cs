using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Gemini tool-calling facade. Kept separate from <see cref="IGeminiService"/> so
/// the existing text/structured flows (and their test doubles) are untouched.
/// Semantics mirror <see cref="IGeminiService"/>: any failure returns null so the
/// caller can fall back to the deterministic provider, and the API key is never
/// exposed or logged.
/// </summary>
public interface IGeminiToolCallService
{
    /// <summary>
    /// True when Gemini is available to be attempted (enabled in configuration
    /// AND an API key is present). Same circuit-breaker behavior as
    /// <see cref="IGeminiService.IsAvailable"/>.
    /// </summary>
    bool IsAvailable { get; }

    /// <summary>
    /// Sends one tool-calling turn. <see cref="GeminiConversationMessage.Role"/>
    /// must be one of "user", "model" or "function" (the roles Gemini accepts).
    /// The request uses function-calling mode AUTO with the provided declarations.
    /// Returns a turn that is either final text or one requested function call;
    /// null when Gemini is unavailable, failed, timed out or returned an empty /
    /// malformed response (callers then stop tool-calling and fall back).
    /// </summary>
    Task<GeminiToolTurn?> GenerateToolTurnAsync(
        IReadOnlyList<GeminiConversationMessage> contents,
        string systemInstruction,
        IReadOnlyList<GeminiFunctionDeclaration> functions,
        CancellationToken cancellationToken = default);
}