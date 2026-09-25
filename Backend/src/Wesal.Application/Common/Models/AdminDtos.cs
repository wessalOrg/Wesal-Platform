using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

// --- US-ADMIN-01: pending queue + full hall/owner detail ---

public class AdminPendingHallDto
{
    public Guid HallId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? ThumbnailUrl { get; init; }
    public DateTimeOffset SubmittedAt { get; init; }
}

public class AdminHallDetailDto
{
    public Guid HallId { get; init; }
    public string Name { get; init; } = string.Empty;
    public HallRegion Region { get; init; }
    public string RegionDisplayName { get; init; } = string.Empty;
    public string Address { get; init; } = string.Empty;
    public string? DetailedAddress { get; init; }
    public string? Description { get; init; }
    public int Capacity { get; init; }
    public decimal? Price { get; init; }
    public DateTimeOffset SubmittedAt { get; init; }
    public HallStatus Status { get; init; }
    public string? OwnerId { get; init; }
    public string? OwnerFullName { get; init; }
    public string? OwnerPhoneNumber { get; init; }
    public string? OwnerEmail { get; init; }
    public string? MainImageUrl { get; init; }
    public string? YouTubeVideoUrl { get; init; }
    public IReadOnlyList<string> Features { get; init; } = [];
    public string? OtherFeatures { get; init; }
    public IReadOnlyList<string> PhotoUrls { get; init; } = [];

    /// <summary>Live subscription payment state (US-ADMIN-07/10).</summary>
    public HallPaymentStatus PaymentStatus { get; init; }

    /// <summary>True when the owner has uploaded an identity document required to reach the Add Hall flow.</summary>
    public bool OwnerHasIdentityDocument { get; init; }
}

/// <summary>Repository projection for the full submission drill-down; assembled by
/// <see cref="AdminHallDetailDto"/> (which adds the localized region display name) in
/// the admin service layer.</summary>
public class AdminHallDetailRow
{
    public Guid HallId { get; init; }
    public string Name { get; init; } = string.Empty;
    public HallRegion Region { get; init; }
    public string Address { get; init; } = string.Empty;
    public string? DetailedAddress { get; init; }
    public string? Description { get; init; }
    public int Capacity { get; init; }
    public decimal? Price { get; init; }
    public DateTimeOffset SubmittedAt { get; init; }
    public HallStatus Status { get; init; }
    public string? OwnerId { get; init; }
    public string? OwnerFullName { get; init; }
    public string? OwnerPhoneNumber { get; init; }
    public string? OwnerEmail { get; init; }
    public string? MainImageUrl { get; init; }
    public string? YouTubeVideoUrl { get; init; }
    public IReadOnlyList<string> Features { get; init; } = [];
    public string? OtherFeatures { get; init; }
    public IReadOnlyList<string> PhotoUrls { get; init; } = [];

    /// <summary>Live subscription payment state (US-ADMIN-07/10).</summary>
    public HallPaymentStatus PaymentStatus { get; init; }

    /// <summary>True when the owner has uploaded an identity document required to reach the Add Hall flow.</summary>
    public bool OwnerHasIdentityDocument { get; init; }
}

// --- US-ADMIN-03: rejection ---

public class AdminRejectHallRequestDto
{
    /// <summary>Optional human-readable rejection reason delivered to the owner's inbox.</summary>
    public string? Reason { get; init; }

    /// <summary>
    /// Required before rejecting a hall that is currently Approved (live). Rejecting a
    /// live hall is destructive and must be explicitly confirmed by the Admin.
    /// </summary>
    public bool ConfirmLiveApproved { get; init; }
}

public class AdminRejectHallResultDto
{
    public Guid HallId { get; init; }
    public string Name { get; init; } = string.Empty;
    public HallStatus Status { get; init; }
    public bool IsAlreadyRejected { get; init; }
    public bool NotificationDelivered { get; init; }
}

// --- US-ADMIN-05: manual lock ---

public class AdminLockHallResultDto
{
    public Guid HallId { get; init; }
    public string Name { get; init; } = string.Empty;
    public bool IsLocked { get; init; }
    public DateTimeOffset? LockedAt { get; init; }
    public string? LockedByAdminUserId { get; init; }
}

// --- US-ADMIN-11: subscription overview ---

public class AdminSubscriptionOverviewQueryDto
{
    public const string SortByOwnerName = "ownerName";
    public const string SortByDaysRemaining = "daysRemaining";

    public HallStatus? ApprovalStatus { get; init; }

    public HallPaymentStatus? PaymentStatus { get; init; }

    /// <summary>When set, only halls that are locked (Admin lock and/or system lock) are returned.</summary>
    public bool? Locked { get; init; }

    /// <summary>Sort key: <see cref="SortByOwnerName"/> (default) or <see cref="SortByDaysRemaining"/>.</summary>
    public string SortBy { get; init; } = SortByOwnerName;
}

public class AdminSubscriptionHallRow
{
    public Guid HallId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string OwnerId { get; init; } = string.Empty;
    public string? OwnerFullName { get; init; }
    public string? OwnerPhoneNumber { get; init; }
    public string? OwnerEmail { get; init; }
    public HallStatus Status { get; init; }
    public HallPaymentStatus PaymentStatus { get; init; }
    public bool SystemLocked { get; init; }
    public bool AdminLocked { get; init; }
    public DateOnly? NextBillingDate { get; init; }
    public DateOnly? LastPaymentDate { get; init; }
    public DateTimeOffset? LockedAt { get; init; }
    public string? LockedByAdminUserId { get; init; }
}

public class AdminSubscriptionHallDto
{
    public Guid HallId { get; init; }
    public string Name { get; init; } = string.Empty;
    public HallStatus ApprovalStatus { get; init; }
    public HallPaymentStatus PaymentStatus { get; init; }
    public bool SystemLocked { get; init; }
    public bool AdminLocked { get; init; }
    public DateOnly? NextBillingDate { get; init; }
    public int? DaysRemaining { get; init; }
    public DateOnly? LastPaymentDate { get; init; }
    public DateTimeOffset? LockedAt { get; init; }
    public string? LockedByAdminUserId { get; init; }
}

public class AdminSubscriptionOwnerGroupDto
{
    public string OwnerId { get; init; } = string.Empty;
    public string? OwnerFullName { get; init; }
    public string? OwnerPhoneNumber { get; init; }
    public string? OwnerEmail { get; init; }
    public IReadOnlyList<AdminSubscriptionHallDto> Halls { get; init; } = [];
}

// --- US-ADMIN-06: manual unlock ---

public class AdminUnlockHallResultDto
{
    public Guid HallId { get; init; }
    public string Name { get; init; } = string.Empty;
    public bool IsLocked { get; init; }
    public DateTimeOffset? UnlockedAt { get; init; }
    public string? UnlockedByAdminUserId { get; init; }

    /// <summary>
    /// Combined management-access state after unlock, computed as
    /// (PaymentStatus == Paid) AND (SystemLocked == false) AND (AdminLocked == false).
    /// False means the hall is still inaccessible (payment required and/or system locked).
    /// </summary>
    public bool ManagementAccessRestored { get; init; }
}

// --- US-ADMIN-04: direct Admin-to-Owner messaging ---

public class AdminOwnerMessageRequestDto
{
    public string Content { get; init; } = string.Empty;
}

public class AdminOwnerMessageResponseDto
{
    public Guid MessageId { get; init; }
    public Guid ConversationId { get; init; }
    public Guid HallId { get; init; }
    public string Content { get; init; } = string.Empty;
    public DateTimeOffset SentAt { get; init; }

    /// <summary>True when the Hall Owner's account is currently blocked and the message was queued rather than delivered in real time.</summary>
    public bool OwnerBlocked { get; init; }

    /// <summary>When the owner is blocked, the message is queued and this flag lets the Admin UI surface 'delivery pending - owner is blocked'.</summary>
    public bool DeliveryPending { get; init; }
}

// --- US-ADMIN-10: confirm subscription payment ---

public class AdminMarkPaidResultDto
{
    public Guid HallId { get; init; }
    public string Name { get; init; } = string.Empty;
    public HallPaymentStatus PaymentStatus { get; init; }
    public bool SystemLocked { get; init; }
    public bool AdminLocked { get; init; }
    public DateOnly? CycleStart { get; init; }
    public DateOnly? CycleEnd { get; init; }
    public decimal AmountIls { get; init; }

    /// <summary>True when the hall was already Paid with an active cycle and the call was a no-op (no second overlapping cycle created).</summary>
    public bool AlreadyPaidWithActiveCycle { get; init; }
}

// --- US-ADMIN-08: 3-day subscription expiry warning candidates ---

public class SubscriptionCycleWarningCandidate
{
    public Guid HallId { get; init; }
    public string HallName { get; init; } = string.Empty;
    public string OwnerId { get; init; } = string.Empty;
    public string? OwnerEmail { get; init; }
    public DateOnly CycleEnd { get; init; }
}