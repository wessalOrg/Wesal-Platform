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

    /// <summary>
    /// Owner-selected address-area name from the dependent address list for the hall's
    /// <see cref="Region"/>. Selected from the predefined catalog, never free-text typed
    /// by the owner.
    /// </summary>
    public string? DetailedAddress { get; set; }

    /// <summary>
    /// Optional YouTube video URL for the hall (US-HALL). Validated to be a real YouTube
    /// link; never mandatory.
    /// </summary>
    public string? YouTubeVideoUrl { get; set; }

    /// <summary>
    /// Additional owner-typed custom features beyond the predefined feature list
    /// (free text, strictly length-limited).
    /// </summary>
    public string? OtherFeatures { get; set; }

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
    /// Relative storage URL of the owner-uploaded subscription payment receipt, stored
    /// OUTSIDE the public static-file area; it can only be read through the protected
    /// Admin (and owner) receipt endpoints.
    /// </summary>
    public string? PaymentReceiptUrl { get; set; }

    /// <summary>When the owner uploaded the payment receipt (UTC).</summary>
    public DateTimeOffset? PaymentReceiptUploadedAt { get; set; }

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

    /// <summary>
    /// Hourly booking window start (WESAL-TASK-1). The hall is bookable in fixed
    /// 60-minute hourly slots from <see cref="HourlySlotStart"/> up to (but not
    /// including) <see cref="HourlySlotEnd"/>. Null until the owner configures the hall.
    /// </summary>
    public TimeOnly? HourlySlotStart { get; set; }

    /// <summary>
    /// Hourly booking window end (exclusive) under the new hourly-slot model
    /// (WESAL-TASK-1). See <see cref="HourlySlotStart"/>.
    /// </summary>
    public TimeOnly? HourlySlotEnd { get; set; }

    /// <summary>
    /// When true (default) seekers see every hourly slot for a date including ones
    /// already <see cref="HallSlotStatus.Booked"/>, so the "booked" hours are visible
    /// but not selectable. When false, booked slots are hidden entirely and only
    /// available hours are returned (WESAL-TASK-1 "show/hide booked days and hours").
    /// </summary>
    public bool ShowBookedSlots { get; set; } = true;

    /// <summary>
    /// New-model per-day availability rows (WESAL-TASK-1). One row per (HallId,
    /// Date); a missing row means the day defaults to Open. <see cref="Wesal.Domain.Enums.HallDayAvailability"/>.IsOpen
    /// == false is the owner's block-entire-day action.
    /// </summary>
    public ICollection<HallDayAvailability> DayAvailabilities { get; set; } = [];

    /// <summary>
    /// New-model hourly slot rows (WESAL-TASK-1). One row per (HallId, Date,
    /// StartTime) that has been materialised; a missing (HallId, Date, StartTime) row
    /// means that hour is Available. An explicit <see cref="HallSlotStatus.Booked"/> row
    /// marks the hour as taken.
    /// </summary>
    public ICollection<HallSlotAvailability> SlotAvailabilities { get; set; } = [];

    public ICollection<HallImage> Images { get; set; } = [];

    public ICollection<HallFeature> Features { get; set; } = [];
}
