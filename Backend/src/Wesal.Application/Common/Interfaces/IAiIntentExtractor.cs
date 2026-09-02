using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Classifies a user message into a single structured intent. Implementations may
/// use Gemini for extraction, but MUST degrade gracefully (for example to a
/// deterministic classifier) whenever Gemini is unavailable, fails, times out, or
/// returns an invalid/unrecognized classification. All extracted values must be
/// validated before they are returned.
/// </summary>
public interface IAiIntentExtractor
{
    Task<AiAssistantIntentDto> ExtractAsync(
        string message,
        string? language,
        CancellationToken cancellationToken = default);
}