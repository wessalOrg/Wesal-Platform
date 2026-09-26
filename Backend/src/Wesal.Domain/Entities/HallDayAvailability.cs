using Wesal.Domain.Common;
using Wesal.Domain.Enums;

namespace Wesal.Domain.Entities;

/// <summary>
/// Per-day booking gate for a hall under the new hourly-slot availability model
/// (WESAL-TASK-1). Exactly one row per (HallId, Date); when a row is absent the day
/// defaults to Open. <see cref="IsOpen"/> == false is the owner's "block entire day"
/// action — the day is not bookable at all, through either booking endpoint,
/// regardless of the <see cref="Hall.ShowBookedSlots"/> toggle.
///
/// That toggle governs ONLY how the closed day is presented, never whether it is
/// bookable. With the toggle ON the day is reported as closed. With the toggle OFF the
/// day is deliberately reported as open with no slots, which makes it indistinguishable
/// from a hidden fully-booked day: the block is never disclosed to seekers in any form.
/// This is intentional — <see cref="Hall.ShowBookedSlots"/> is the owner's privacy
/// control, and a seeker must not be able to infer a block from the response.
/// </summary>
public class HallDayAvailability : BaseAuditableEntity
{
    public Guid HallId { get; set; }

    public Hall Hall { get; set; } = null!;

    public DateOnly Date { get; set; }

    /// <summary>
    /// The stored booking gate: true → the day can be booked (slots within it are
    /// evaluated individually); false → the owner blocked the whole day, so every slot
    /// is unavailable and any create-booking attempt against this date is rejected with a
    /// 409 conflict. This value is the single source of truth for bookability and is
    /// enforced server-side on every booking path regardless of how the day is displayed.
    /// </summary>
    public bool IsOpen { get; set; } = true;
}
