using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Unified AI assistant service: takes a single natural-language message and
/// returns a stable, consumer-friendly response (see <see cref="AiAssistantResponse"/>)
/// with a structured intent classification and verified platform data. Gemini is
/// used only for intent extraction (NLU); all data access goes through existing
/// platform services and repositories.
/// </summary>
public interface IAiAssistantService
{
    Task<AiAssistantResponse> ProcessMessageAsync(
        string message,
        string? language,
        CancellationToken cancellationToken = default,
        AiConversationContext? context = null);
}