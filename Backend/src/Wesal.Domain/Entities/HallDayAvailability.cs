using Wesal.Domain.Common;
using Wesal.Domain.Enums;

namespace Wesal.Domain.Entities;

/// <summary>
/// Per-day booking gate for a hall under the new hourly-slot availability model
/// (WESAL-TASK-1). Exactly one row per (HallId, Date); when a row is absent the day
/// defaults to Open. <see cref="IsOpen"/> == false is the owner's "block entire day"
    /// action — the day is not bookable at all, through either booking endpoint,
    /// regardless of the <see cref="Hall.ShowBookedSlots"/> toggle. That toggle governs
    /// only how the closed day is displayed: with it OFF the day is reported as open so
    /// the block stays indistinguishable from hidden fully-booked time.
/// </summary>
public class HallDayAvailability : BaseAuditableEntity
{
    public Guid HallId { get; set; }

    public Hall Hall { get; set; } = null!;

    public DateOnly Date { get; set; }

    /// <summary>
    /// true → the day can be booked (slots within it are evaluated individually).
    /// false → the owner blocked the whole day; every slot is unavailable and any
    /// create-booking attempt against this date is rejected (clear 400).
    /// </summary>
    public bool IsOpen { get; set; } = true;
}
