using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IChatSessionService
{
    Task<AiSessionResponse> InitializeSessionAsync(string? language, CancellationToken cancellationToken = default);

    Task<AiSessionResponse?> GetSessionAsync(Guid sessionId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Passive invitation support: validates session existence/expiry without mutating
    /// session state (no LastActivityAt/ExpiresAt refresh). Ensures invitation checks
    /// do not corrupt, reset, or interfere with existing chat sessions. Safe for
    /// multi-tab polling. Returns null for missing/expired/invalid sessions.
    /// </summary>
    Task<AiSessionResponse?> PeekSessionAsync(Guid sessionId, CancellationToken cancellationToken = default);
}
