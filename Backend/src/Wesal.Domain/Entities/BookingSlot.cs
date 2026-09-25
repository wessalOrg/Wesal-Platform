using Wesal.Domain.Common;

namespace Wesal.Domain.Entities;

/// <summary>
/// One 60-minute hourly slot occupied by a <see cref="Entities.Booking"/>. A booking
/// owns one or more slots, all on the booking's <see cref="Entities.Booking.Date"/>,
/// so a seeker can reserve a single hour or several hours.
/// </summary>
public class BookingSlot : BaseAuditableEntity
{
    public Guid BookingId { get; set; }

    public Booking Booking { get; set; } = null!;

    /// <summary>Start of the reserved hour, e.g. 10:00.</summary>
    public TimeOnly StartTime { get; set; }

    /// <summary>End of the reserved hour, e.g. 11:00 (always StartTime + 1 hour).</summary>
    public TimeOnly EndTime { get; set; }
}
