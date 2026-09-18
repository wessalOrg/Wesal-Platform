namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Delivers the 3-day subscription-expiry warning to hall owners (US-ADMIN-08,
/// FR-SUB-02). Each hall's paid cycle is tracked independently and the warning fires
/// exactly 3 days before that specific cycle's end date. Delivery is idempotent per
/// cycle: the same cycle never triggers more than one warning even if the daily job
/// runs repeatedly within that day, while a failed e-mail send is retried (with
/// escalation) until the cycle ends.
/// </summary>
public interface ISubscriptionExpiryWarningService
{
    /// <summary>
    /// Runs one warning pass and returns the number of halls for which the warning was
    /// newly delivered (first-time or a successful e-mail retry).
    /// </summary>
    Task<int> WarnCyclesEndingSoonAsync(CancellationToken cancellationToken = default);
}