namespace Wesal.Domain.Enums;

/// <summary>
/// Server-computed subscription state of a hall as shown to its owner
/// (US-OWNER-17, FR-HALL-05). Always derived from the persisted hall record on
/// each view rather than read from a cached value.
/// </summary>
public enum HallSubscriptionStatus
{
    /// <summary>The 30-day paid cycle is running (or ends today) and the hall is not admin-locked.</summary>
    Active = 0,

    /// <summary>No active subscription cycle exists yet (Pending Review / Rejected, or Approved but unpaid).</summary>
    PaymentPending = 1,

    /// <summary>The paid cycle has ended without renewal (system-locked for non-payment).</summary>
    Expired = 2,

    /// <summary>The hall is manually locked by an Admin, regardless of payment status.</summary>
    Locked = 3
}