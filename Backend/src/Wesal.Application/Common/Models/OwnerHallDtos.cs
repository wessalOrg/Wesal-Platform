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
}

/// <summary>
/// Full details of a hall owned by the authenticated Hall Owner (US-OWNER-07). The
/// hall is resolved exclusively from the authenticated session; ownership is enforced
/// server-side and the DTO never carries a client-supplied owner identity. The
/// editable fields mirror the Add Hall fields (FR-HALL-01), plus the current approval
/// status and a server-computed editability flag used to block editing of a hall
/// currently under Admin review (and of admin-locked halls once that state exists).
/// </summary>
public class OwnerHallDetailsDto
{
    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public string? MainImageUrl { get; init; }

    public string? ContactPhone { get; init; }

    public HallRegion Region { get; init; }

    public string RegionDisplayName { get; init; } = string.Empty;

    public string Address { get; init; } = string.Empty;

    public string? Description { get; init; }

    public int Capacity { get; init; }

    public decimal? Price { get; init; }

    public bool ShowPrice { get; init; }

    public HallStatus Status { get; init; }

    public bool IsEditable { get; init; }

    public IReadOnlyList<OwnerHallPhotoDto> Photos { get; init; } = [];

    public IReadOnlyList<OwnerHallBookingPeriodDto> BookingPeriods { get; init; } = [];
}

public class OwnerHallPhotoDto
{
    public Guid Id { get; init; }

    public string Url { get; init; } = string.Empty;

    public int DisplayOrder { get; init; }
}

public class OwnerHallBookingPeriodDto
{
    public BookingPeriodType Type { get; init; }

    public TimeOnly StartTime { get; init; }

    public TimeOnly EndTime { get; init; }
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

    public string Address { get; init; } = string.Empty;

    public string? Description { get; init; }

    public int Capacity { get; init; }

    public decimal? Price { get; init; }

    public bool ShowPrice { get; init; }

    public IReadOnlyList<UpdateOwnerHallPhotoDto> Photos { get; init; } = [];

    public IReadOnlyList<UpdateOwnerHallBookingPeriodDto> BookingPeriods { get; init; } = [];
}

public class UpdateOwnerHallPhotoDto
{
    public string Url { get; init; } = string.Empty;

    public int DisplayOrder { get; init; }
}

public class UpdateOwnerHallBookingPeriodDto
{
    public BookingPeriodType Type { get; init; }

    public TimeOnly StartTime { get; init; }

    public TimeOnly EndTime { get; init; }
}