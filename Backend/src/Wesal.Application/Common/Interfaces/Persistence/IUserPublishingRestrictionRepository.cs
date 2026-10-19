using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IUserPublishingRestrictionRepository
{
    Task AcquireUserLockAsync(string userId, CancellationToken cancellationToken = default);
    Task<DateTimeOffset?> GetActiveEndsAtAsync(string userId, DateTimeOffset now, CancellationToken cancellationToken = default);
    Task<UserPublishingRestriction?> GetActiveAsync(string userId, DateTimeOffset now, CancellationToken cancellationToken = default);
    Task<UserPublishingRestriction?> GetCurrentAsync(string userId, DateTimeOffset now, CancellationToken cancellationToken = default);
    Task AddAsync(UserPublishingRestriction restriction, CancellationToken cancellationToken = default);
    Task<int> LiftExpiredAsync(DateTimeOffset now, CancellationToken cancellationToken = default);
}
