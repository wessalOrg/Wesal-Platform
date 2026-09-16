using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Runs the bounded Gemini tool-calling orchestration for the Wesal assistant:
/// grounds the model in official knowledge, exposes only the approved tools via
/// <see cref="IWesalToolGateway"/>, enforces strict per-turn and repeated-call
/// budgets, and always returns a safe bilingual answer. The model is never
/// trusted with authentication fragments and never chooses which code runs.
/// </summary>
public interface IGeminiToolOrchestrator
{
    /// <summary>
    /// Processes one user message. Requires a non-empty message bounded to a
    /// maximum safe length. When Gemini is unavailable or fails, or the model
    /// never produces usable text within the budget, the orchestrator falls back
    /// to the deterministic <see cref="IHowToService"/> answer so the assistant
    /// still responds deterministically.
    /// </summary>
    Task<WesalToolOrchestrationResult> ExecuteAsync(
        string message,
        string? language,
        CancellationToken cancellationToken = default,
        AiConversationContext? context = null);
}