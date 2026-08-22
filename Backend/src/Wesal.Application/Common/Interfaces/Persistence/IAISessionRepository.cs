using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IAISessionRepository : IGenericRepository<AISession>
{
    Task<AISession?> GetBySessionIdAsync(string sessionId, CancellationToken cancellationToken = default);
    Task<AISession?> GetActiveSessionByUserIdAsync(string userId, CancellationToken cancellationToken = default);
    Task<AISession?> GetActiveGuestSessionAsync(string guestIdentifier, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AISession>> GetExpiredSessionsAsync(CancellationToken cancellationToken = default);
}