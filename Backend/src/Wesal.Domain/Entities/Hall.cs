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

    public ICollection<HallBookingPeriod> BookingPeriods { get; set; } = [];

    public ICollection<HallAvailability> Availability { get; set; } = [];

    public ICollection<HallImage> Images { get; set; } = [];
}
