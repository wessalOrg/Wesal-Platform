using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Identity;

/// <summary>
/// Resolves lock state from the historical AccountLocks table at request time.
/// </summary>
public sealed class AccountLockService : IAccountLockService
{
    private readonly TimeProvider _timeProvider;
    private readonly IAccountLockRepository _restrictions;

    public AccountLockService(IAccountLockRepository restrictions, TimeProvider timeProvider)
    {
        _restrictions = restrictions;
        _timeProvider = timeProvider;
    }

    public async Task<DateTimeOffset?> GetLockedUntilAsync(string userId, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var now = _timeProvider.GetUtcNow();
        return await _restrictions.GetActiveEndsAtAsync(userId, now, cancellationToken);
    }

    public async Task EnsureUnlockedAsync(string userId, CancellationToken cancellationToken = default)
    {
        if (await GetLockedUntilAsync(userId, cancellationToken) is { } lockedUntil)
            throw new ForbiddenException($"Your account is locked until {lockedUntil:O}.");
    }
}
