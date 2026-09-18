using Wesal.Domain.Common;
using Wesal.Domain.Enums;

namespace Wesal.Domain.Entities;

public class Hall : BaseAuditableEntity
{
    public string Name { get; set; } = string.Empty;

    public string? MainImageUrl { get; set; }

    public string? ContactPhone { get; set; }

    public HallRegion Region { get; set; }

    public string Address { get; set; } = string.Empty;

    public int Capacity { get; set; }

    public decimal? Price { get; set; }

    public bool ShowPrice { get; set; } = true;

    public string? Description { get; set; }

    public HallStatus Status { get; set; } = HallStatus.PendingReview;

    public bool IsDeleted { get; set; }

    public string? OwnerId { get; set; }

    /// <summary>
    /// End of the hall's current 30-day paid subscription cycle, i.e. its next
    /// billing date (US-OWNER-17, FR-SUB-01/FR-SUB-02). Null when the hall has never
    /// had a confirmed payment; a non-null value means the Admin confirmed a payment
    /// confirming the cycle. The per-hall cycle starts on that payment-confirmation.
    /// </summary>
    public DateOnly? SubscriptionCycleEnd { get; set; }

    /// <summary>
    /// Start of the hall's last confirmed paid subscription cycle, i.e. its last
    /// payment date (US-ADMIN-11). Null until the Admin confirms a first payment. The
    /// Admin subscription workflow seeds <see cref="SubscriptionCycleStart"/> and
    /// <see cref="SubscriptionCycleEnd"/> together with <see cref="PaymentStatus"/>.
    /// </summary>
    public DateOnly? SubscriptionCycleStart { get; set; }

    /// <summary>
    /// Payment state of the hall subscription (FR-SUB-01, US-ADMIN-07). Independent of
    /// <see cref="Status"/>: an Approved-but-Unpaid hall has zero management access
    /// until an Admin marks it Paid. A hall is Paid from the moment the Admin confirms
    /// a payment; it never drifts from <see cref="SubscriptionCycleStart"/> (Paid means
    /// a confirmed cycle exists).
    /// </summary>
    public HallPaymentStatus PaymentStatus { get; set; } = HallPaymentStatus.Unpaid;

    /// <summary>
    /// Manual Admin lock for this hall (FR-SUB-05, US-ADMIN-05). Independent of the
    /// payment-driven state: when set, hall access is restricted regardless of
    /// subscription status until an Admin unlocks it. Never modified by the automatic
    /// system lock (US-ADMIN-09).
    /// </summary>
    public bool IsAdminLocked { get; set; }

    /// <summary>
    /// Admin user who applied the manual lock (US-ADMIN-05 audit trail). Null when the
    /// hall has never been locked by an Admin.
    /// </summary>
    public string? LockedByAdminUserId { get; set; }

    /// <summary>
    /// When the manual Admin lock was applied (US-ADMIN-05 audit trail). Null when the
    /// hall has never been locked by an Admin.
    /// </summary>
    public DateTimeOffset? LockedAt { get; set; }

    /// <summary>
    /// Automatic system lock for non-payment (FR-SUB-03, US-ADMIN-09): set when the
    /// current subscription cycle's end date passes with no confirmed payment for the
    /// next cycle. Independent of and never altered by <see cref="IsAdminLocked"/>.
    /// </summary>
    public bool SystemLocked { get; set; }

    /// <summary>
    /// Admin user who lifted the manual lock (US-ADMIN-06 audit trail). Null when the
    /// hall has never been unlocked by an Admin.
    /// </summary>
    public string? UnlockedByAdminUserId { get; set; }

    /// <summary>
    /// When the manual Admin lock was lifted (US-ADMIN-06 audit trail). Null when the
    /// hall has never been unlocked by an Admin.
    /// </summary>
    public DateTimeOffset? UnlockedAt { get; set; }

    /// <summary>
    /// Subscription cycle this hall's 3-day expiry warning was already delivered for
    /// (US-ADMIN-08, FR-SUB-02). Null until the daily warning job successfully notifies
    /// the owner; a value equal to <see cref="SubscriptionCycleEnd"/> makes the job skip
    /// the hall so the same cycle never warns more than once.
    /// </summary>
    public DateOnly? WarningSentForCycleEnd { get; set; }

    /// <summary>
    /// Consecutive failed delivery attempts of this hall's subscription expiry warning
    /// (US-ADMIN-08, FR-SUB-02). Reset to zero when the warning is finally delivered;
    /// a positive value makes the daily job retry the still-undelivered warning with
    /// escalation until the cycle ends.
    /// </summary>
    public int WarningSentAttempts { get; set; }

    public ICollection<HallBookingPeriod> BookingPeriods { get; set; } = [];

    public ICollection<HallAvailability> Availability { get; set; } = [];

    public ICollection<HallImage> Images { get; set; } = [];
}
