using Wesal.Domain.Common;
using Wesal.Domain.Enums;

namespace Wesal.Domain.Entities;

public class Booking : BaseAuditableEntity
{
    public Guid HallId { get; set; }

    public Hall Hall { get; set; } = null!;

    public string RequesterUserId { get; set; } = string.Empty;

    /// <summary>
    /// The calendar day this booking reserves. Every <see cref="BookingSlot"/> in
    /// <see cref="Slots"/> falls on this same date.
    /// </summary>
    public DateOnly Date { get; set; }

    /// <summary>
    /// The 60-minute hourly slots this booking occupies, in order, on <see cref="Date"/>.
    /// One booking can cover a single hour or several hours; each slot
    /// has a matching <see cref="HallSlotAvailability"/> row marked
    /// <see cref="HallSlotStatus.Booked"/> while the booking is active.
    /// </summary>
    public ICollection<BookingSlot> Slots { get; set; } = [];

    /// <summary>
    /// Display name the seeker supplies when creating the booking
    /// (FR-HALL hourly-slot booking; seeker-provided). Required.
    /// </summary>
    public string? NameOnBooking { get; set; }

    public BookingStatus Status { get; set; } = BookingStatus.Pending;

    /// <summary>
    /// The time range covered by this booking, e.g. "10:00 - 12:00" for a two-hour
    /// booking, used in owner/requester-facing messages. Empty when the booking has no
    /// slots.
    /// </summary>
    public string HourlyTimeRange
    {
        get
        {
            if (Slots.Count == 0)
            {
                return string.Empty;
            }

            var ordered = Slots.OrderBy(slot => slot.StartTime).ToList();

            return $"{ordered[0].StartTime:HH\\:mm} - {ordered[^1].EndTime:HH\\:mm}";
        }
    }

    public string? RejectionReason { get; set; }

    public Guid? RejectionMessageId { get; set; }
}
