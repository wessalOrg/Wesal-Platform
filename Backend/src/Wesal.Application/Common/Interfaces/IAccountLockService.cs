namespace Wesal.Application.Common.Interfaces;

using Wesal.Domain.Exceptions;

/// <summary>
/// Single request-time source for account lock state. The persistence table retains its
/// historical name, but all application behavior treats an active row as an account lock.
/// </summary>
public interface IAccountLockService
{
    /// <summary>
    /// Returns the end of an active lock, using the request-time clock; null means unlocked.
    /// </summary>
    Task<DateTimeOffset?> GetLockedUntilAsync(string userId, CancellationToken cancellationToken = default);

    async Task<bool> IsLockedAsync(string userId, CancellationToken cancellationToken = default)
        => await GetLockedUntilAsync(userId, cancellationToken) is not null;

    async Task EnsureUnlockedAsync(string userId, CancellationToken cancellationToken = default)
    {
        if (await GetLockedUntilAsync(userId, cancellationToken) is { } lockedUntil)
            throw new ForbiddenException($"Your account is locked until {lockedUntil:O}.");
    }
}
