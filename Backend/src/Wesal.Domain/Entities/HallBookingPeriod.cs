using Wesal.Domain.Common;
using Wesal.Domain.Enums;

namespace Wesal.Domain.Entities;

public class HallBookingPeriod : BaseEntity
{
    public Guid HallId { get; set; }

    public Hall Hall { get; set; } = null!;

    public BookingPeriodType Type { get; set; }

    public TimeOnly StartTime { get; set; }

    public TimeOnly EndTime { get; set; }
}
