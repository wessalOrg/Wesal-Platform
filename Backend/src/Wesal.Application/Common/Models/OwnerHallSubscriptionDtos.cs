using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

/// <summary>
/// The current subscription state of a hall owned by the authenticated Hall Owner
/// (US-OWNER-17, FR-HALL-05). The status is always computed server-side from the
/// persisted hall record on each request (never cached), so the owner always sees the
/// current active/expired/locked state and the relevant billing date even when an
/// Admin confirmed a payment or locked the hall in another session. Ownership is
/// resolved exclusively from the authenticated session; the DTO never carries a
/// client-supplied owner identity.
/// </summary>
public class OwnerHallSubscriptionDto
{
    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public HallSubscriptionStatus Status { get; init; }

    /// <summary>
    /// End of the hall's current 30-day paid cycle (the next billing date). Absent
    /// when no active subscription cycle exists yet (Pending Review / Rejected or
    /// Approved but unpaid) — those halls show a payment-pending status with no
    /// active billing date.
    /// </summary>
    public DateOnly? NextBillingDate { get; init; }

    /// <summary>
    /// Whole days left in the current paid cycle (WESAL-TASK-4, Edit 4). Computed
    /// server-side on every request, never cached.
    ///
    /// The value is deliberately explicit rather than clamped at zero:
    /// <list type="bullet">
    ///   <item><c>null</c> — never paid: no cycle exists, so there is nothing to count down;</item>
    ///   <item><c>30</c> — just paid: the full cycle remains;</item>
    ///   <item><c>1..29</c> — partway through the cycle;</item>
    ///   <item><c>0</c> — the cycle ends today (still active for this day);</item>
    ///   <item><c>&lt; 0</c> — expired: negative is how many days ago it lapsed.</item>
    /// </list>
    /// </summary>
    public int? DaysRemaining { get; init; }
}