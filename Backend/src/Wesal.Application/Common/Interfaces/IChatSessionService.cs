using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IChatSessionService
{
    Task<AiSessionResponse> InitializeSessionAsync(string? language, CancellationToken cancellationToken = default, string? userId = null);

    Task<AiSessionResponse?> GetSessionAsync(Guid sessionId, CancellationToken cancellationToken = default, string? userId = null);

    /// <summary>
    /// Passive invitation support: validates session existence/expiry without mutating
    /// session state (no LastActivityAt/ExpiresAt refresh). Ensures invitation checks
    /// do not corrupt, reset, or interfere with existing chat sessions. Safe for
    /// multi-tab polling. Returns null for missing/expired/invalid sessions.
    /// </summary>
    Task<AiSessionResponse?> PeekSessionAsync(Guid sessionId, CancellationToken cancellationToken = default, string? userId = null);

    /// <summary>
    /// Returns the bounded, short-lived conversation state (recent user turns plus the
    /// last structured intent) for a live session, or an empty context when the
    /// session is missing/expired or has no history yet. Read-only: never refreshes
    /// session expiry (safe alongside passive multi-tab polling).
    /// </summary>
    Task<AiConversationContext> GetConversationContextAsync(Guid sessionId, CancellationToken cancellationToken = default, string? userId = null);

    Task EndSessionsForUserAsync(string userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Records one user turn and the structured intent it produced into the session's
    /// conversation memory. No-op for missing/expired sessions. The intent is captured
    /// so later turns can carry criteria forward across the conversation.
    /// </summary>
    Task SaveTurnAsync(Guid sessionId, string userMessage, AiAssistantIntentDto? intent, CancellationToken cancellationToken = default);

    /// <summary>
    /// Records one complete exchange — a sanitized, bounded user message, the assistant's
    /// reply, structured intent, shown halls and focused hall — so follow-ups
    /// ("الثانية شو سعرها؟") can be resolved. Storage expires after a short TTL.
    /// No-op for missing/expired sessions.
    /// </summary>
    Task SaveExchangeAsync(
        Guid sessionId,
        string userMessage,
        string? assistantMessage,
        AiAssistantIntentDto? intent,
        IReadOnlyList<AiHallRef>? shownHalls,
        AiHallRef? focusedHall,
        CancellationToken cancellationToken = default);
}
