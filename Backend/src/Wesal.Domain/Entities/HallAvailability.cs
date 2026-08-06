using Wesal.Domain.Common;
using Wesal.Domain.Enums;

namespace Wesal.Domain.Entities;

public class HallAvailability : BaseAuditableEntity
{
    public Guid HallId { get; set; }

    public Hall Hall { get; set; } = null!;

    public DateOnly Date { get; set; }

    public BookingPeriodType PeriodType { get; set; }

    public AvailabilityStatus Status { get; set; } = AvailabilityStatus.Available;
}
