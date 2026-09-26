using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

/// <summary>
/// A hall owned by the authenticated Hall Owner together with its current approval
/// status (US-OWNER-05). The status is always read from the persisted hall record on
/// each request, so the owner sees the latest PendingReview/Approved/Rejected state
/// even when an Admin acted in another session. Ownership is resolved exclusively from
/// the authenticated session; the DTO never carries a client-supplied owner identity.
/// </summary>
public class OwnerHallDto
{
    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public HallStatus Status { get; init; }

    /// <summary>
    /// Live subscription payment state (US-ADMIN-07/10): Unpaid means the hall is
    /// approved/pending and payment is still required (including while the Admin reviews
    /// a payment-proof image the owner sent in the conversation); Paid means the Admin
    /// confirmed the payment (and the hall is public when also Approved).
    /// WESAL-TASK-4 (Edit 4) removed the old ReceiptUploaded state.
    /// </summary>
    public HallPaymentStatus PaymentStatus { get; init; }

    /// <summary>Manual Admin lock (FR-SUB-05 / Edit 16). Independent of SystemLocked.</summary>
    public bool AdminLocked { get; init; }

    /// <summary>Automatic subscription-cycle lock (FR-SUB-03). Independent of AdminLocked.</summary>
    public bool SystemLocked { get; init; }
}

/// <summary>
/// Full details of a hall owned by the authenticated Hall Owner (US-OWNER-07). The
/// hall is resolved exclusively from the authenticated session; ownership is enforced
/// server-side and the DTO never carries a client-supplied owner identity. The
/// editable fields mirror the Add Hall fields (FR-HALL-01), plus the current approval
/// status and a server-computed editability flag. An owner may always edit their own
/// hall regardless of approval status, so editability reflects ownership (already
/// guaranteed by the endpoint) rather than any review state.
/// </summary>
public class OwnerHallDetailsDto
{
    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public string? MainImageUrl { get; init; }

    public string? ContactPhone { get; init; }

    public HallRegion Region { get; init; }

    public string RegionDisplayName { get; init; } = string.Empty;

    /// <summary>Address-area name selected from the region's predefined address list.</summary>
    public string Address { get; init; } = string.Empty;

    /// <summary>The owner's own free-text address detail; never list-validated.</summary>
    public string? DetailedAddress { get; init; }

    public string? Description { get; init; }

    public int Capacity { get; init; }

    public decimal? Price { get; init; }

    public bool ShowPrice { get; init; }

    public string? YouTubeVideoUrl { get; init; }

    public IReadOnlyList<string> Features { get; init; } = [];

    public string? OtherFeatures { get; init; }

    public HallStatus Status { get; init; }

    /// <summary>
    /// Always true: an owner may edit their own hall whatever its approval status
    /// (PendingReview, Approved, or Rejected). The endpoint already scopes the request
    /// to halls the caller owns.
    /// </summary>
    public bool IsEditable { get; init; }

    /// <summary>
    /// Live subscription payment state of the hall (see <see cref="OwnerHallDto.PaymentStatus"/>).
    /// </summary>
    public HallPaymentStatus PaymentStatus { get; init; }

    /// <summary>Manual Admin lock (FR-SUB-05 / Edit 16). Independent of SystemLocked.</summary>
    public bool AdminLocked { get; init; }

    /// <summary>Automatic subscription-cycle lock (FR-SUB-03). Independent of AdminLocked.</summary>
    public bool SystemLocked { get; init; }

    public IReadOnlyList<OwnerHallPhotoDto> Photos { get; init; } = [];
}

public class OwnerHallPhotoDto
{
    public Guid Id { get; init; }

    public string Url { get; init; } = string.Empty;

    public int DisplayOrder { get; init; }
}

/// <summary>
/// Payload for updating a hall owned by the authenticated Hall Owner (US-OWNER-07,
/// FR-HALL-02). Mirrors the editable fields of the Add Hall form (FR-HALL-01). The
/// hall's owner identity and approval status are not part of this payload: they are
/// resolved and preserved server-side and can never be changed by the client.
/// </summary>
public class UpdateOwnerHallRequest
{
    public string Name { get; init; } = string.Empty;

    public string? MainImageUrl { get; init; }

    public string? ContactPhone { get; init; }

    public HallRegion Region { get; init; }

    /// <summary>Address-area name selected from the region's predefined address list.</summary>
    public string Address { get; init; } = string.Empty;

    /// <summary>The owner's own free-text address detail; never list-validated.</summary>
    public string? DetailedAddress { get; init; }

    public string? Description { get; init; }

    public int Capacity { get; init; }

    public decimal? Price { get; init; }

    public bool ShowPrice { get; init; }

    public string? YouTubeVideoUrl { get; init; }

    /// <summary>Feature names selected from the predefined catalog (canonical Arabic strings).</summary>
    public IReadOnlyList<string> Features { get; init; } = [];

    /// <summary>Additional owner-typed custom features, length-limited.</summary>
    public string? OtherFeatures { get; init; }

    public IReadOnlyList<UpdateOwnerHallPhotoDto> Photos { get; init; } = [];

    public TimeOnly? HourlySlotStart { get; init; }

    public TimeOnly? HourlySlotEnd { get; init; }
}

public class UpdateOwnerHallPhotoDto
{
    public string Url { get; init; } = string.Empty;

    public int DisplayOrder { get; init; }
}