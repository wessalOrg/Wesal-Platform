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
}