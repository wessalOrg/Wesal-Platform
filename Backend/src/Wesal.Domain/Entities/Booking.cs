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
    /// One booking can cover a single hour or several hours. While the booking is live its
    /// slots are held as <see cref="HallSlotStatus.Reserved"/>, so no competing request can
    /// take the same hours; they only become <see cref="HallSlotStatus.Booked"/> once the
    /// owner confirms the deposit (WESAL-TASK-8).
    /// </summary>
    public ICollection<BookingSlot> Slots { get; set; } = [];

    /// <summary>
    /// Display name the seeker supplies when creating the booking
    /// (FR-HALL hourly-slot booking; seeker-provided). Required.
    /// </summary>
    public string? NameOnBooking { get; set; }

    public BookingStatus Status { get; set; } = BookingStatus.Pending;

    /// <summary>
    /// WESAL-TASK-8 (Edit 8): the deposit (عربون) the owner required when approving this
    /// booking, persisted at approval time. Null until the owner approves, which is why an
    /// approval without a deposit amount is rejected outright rather than defaulted.
    /// The amount is owed by the requester and is settled outside the platform; the booking
    /// only records what was expected and whether the owner has confirmed receiving it.
    /// </summary>
    public decimal? DepositAmount { get; set; }

    /// <summary>
    /// WESAL-TASK-8 (Edit 8): when the owner confirmed receiving the deposit, or null while
    /// it is still outstanding. This is the signal that moves the booking's hours from
    /// <see cref="HallSlotStatus.Reserved"/> to <see cref="HallSlotStatus.Booked"/>, and
    /// once it is set the booking can no longer be rejected or cancelled, because the
    /// money has changed hands.
    /// </summary>
    public DateTimeOffset? DepositPaymentConfirmedAt { get; set; }

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

    /// <summary>
    /// WESAL-TASK-8 (Edit 8): the approval notice sent to the requester, tracked the same
    /// way as <see cref="RejectionMessageId"/>. It makes the notification exactly-once: a
    /// delivery attempt that already produced a message is skipped, and a failed attempt
    /// leaves it null so a later retry can pick the booking up again.
    /// </summary>
    public Guid? ApprovalMessageId { get; set; }
}
