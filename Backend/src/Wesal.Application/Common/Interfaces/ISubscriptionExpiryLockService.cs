namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Applies the automatic system lock for halls whose paid subscription cycle ended
/// with no confirmed renewal (US-ADMIN-09, FR-SUB-03). The payment-state check and
/// the lock-set run inside the same atomic operation so a payment confirmed at the
/// exact deadline moment (FR-SUB-04) is never wrongly locked.
/// </summary>
public interface ISubscriptionExpiryLockService
{
    Task<int> LockExpiredCyclesAsync(CancellationToken cancellationToken = default);
}