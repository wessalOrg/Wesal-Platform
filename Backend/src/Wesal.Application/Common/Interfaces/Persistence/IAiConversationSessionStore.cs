using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

/// <summary>Persistence boundary for short-lived, bounded Mabrouk conversation state.</summary>
public interface IAiConversationSessionStore
{
    Task<AiConversationSession?> GetAsync(Guid sessionId, CancellationToken cancellationToken = default);
    Task AddAsync(AiConversationSession session, CancellationToken cancellationToken = default);
    Task<bool> TryUpdateAsync(AiConversationSession session, int expectedRevision, CancellationToken cancellationToken = default);
    Task DeleteForUserAsync(string userId, CancellationToken cancellationToken = default);
    Task DeleteExpiredAsync(DateTimeOffset now, CancellationToken cancellationToken = default);
}
