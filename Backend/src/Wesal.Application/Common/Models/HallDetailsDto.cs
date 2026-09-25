using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

public class HallDetailsDto
{
    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public string Region { get; init; } = string.Empty;

    public string Address { get; init; } = string.Empty;

    public string? DetailedAddress { get; init; }

    public string? Description { get; init; }

    public int Capacity { get; init; }

    public decimal? Price { get; init; }

    /// <summary>
    /// Whether the owner chose to publish <see cref="Price"/>. Surfaced so a details page
    /// can tell "this hall has no price" apart from "the owner hides the price" instead of
    /// having to infer it from <see cref="Price"/> being null (WESAL-TASK-5, Edit 5).
    /// </summary>
    public bool ShowPrice { get; init; }

    public string? ContactPhone { get; init; }

    public string? MainImageUrl { get; init; }

    public string? YouTubeVideoUrl { get; init; }

    /// <summary>
    /// Start of the hall's 60-minute bookable window (WESAL-TASK-5, Edit 5). Owner-set and
    /// already applied on create/update, so the details view needs it to explain which
    /// hours the <see cref="Availability"/> slots span. Null until the owner configures it.
    /// </summary>
    public TimeOnly? HourlySlotStart { get; init; }

    /// <summary>End (exclusive) of the bookable window. See <see cref="HourlySlotStart"/>.</summary>
    public TimeOnly? HourlySlotEnd { get; init; }

    public IReadOnlyList<string> Features { get; init; } = [];

    public string? OtherFeatures { get; init; }

    public HallStatus Status { get; init; }

    public bool IsOwner { get; init; }

    /// <summary>Gallery in the owner's chosen order. See <see cref="HallImageDto.DisplayOrder"/>.</summary>
    public IReadOnlyList<HallImageDto> Photos { get; init; } = [];

    public IReadOnlyList<HallAvailabilityDto> Availability { get; init; } = [];
}

public class HallImageDto
{
    public Guid Id { get; init; }

    public string Url { get; init; } = string.Empty;

    /// <summary>
    /// The owner's explicit gallery position (WESAL-TASK-5, Edit 5). <see cref="Photos"/>
    /// already arrives sorted by this value, so it is redundant for rendering order, but
    /// exposing it lets a client reconcile or re-order without re-deriving the sort.
    /// </summary>
    public int DisplayOrder { get; init; }
}
