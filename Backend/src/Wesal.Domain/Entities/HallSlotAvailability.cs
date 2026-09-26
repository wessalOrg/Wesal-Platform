using Wesal.Domain.Common;
using Wesal.Domain.Enums;

namespace Wesal.Domain.Entities;

/// <summary>
/// A single hourly availability slot for a hall on a date under the new hourly-slot
/// booking model (WESAL-TASK-1). Exactly one row per (HallId, Date, StartTime);
/// each slot is a 60-minute hour starting at <see cref="StartTime"/>. Slots are
/// created lazily for the hall's open window (<see cref="Hall.HourlySlotStart"/> –
/// <see cref="Hall.HourlySlotEnd"/>) the first time a date is queried; a missing row
/// means "available" for that hour.
/// </summary>
public class HallSlotAvailability : BaseAuditableEntity
{
    public Guid HallId { get; set; }

    public Hall Hall { get; set; } = null!;

    public DateOnly Date { get; set; }

    public TimeOnly StartTime { get; set; }

    public HallSlotStatus Status { get; set; } = HallSlotStatus.Available;
}
