using Wesal.Domain.Common;
using Wesal.Domain.Enums;

namespace Wesal.Domain.Entities;

public class Booking : BaseAuditableEntity
{
    public Guid HallId { get; set; }

    public Hall Hall { get; set; } = null!;

    public string RequesterUserId { get; set; } = string.Empty;

    public DateOnly Date { get; set; }

    /// <summary>
    /// Legacy two-period slot key, kept only for dormant/cold rows already inserted
    /// under the old fixed two-period model (WESAL-TASK-1 keeps legacy tables data
    /// intact). New hourly-slot bookings leave it at its default and carry their real
    /// identity in <see cref="SlotStart"/> instead.
    /// </summary>
    public BookingPeriodType Period { get; set; }

    /// <summary>
    /// Start of the booked hourly slot under the new hourly-slot booking model
    /// (WESAL-TASK-1). Along with <see cref="Date"/> it uniquely identifies the slot
    /// (60-minute hourly slots); the matching <see cref="HallSlotAvailability"/> row is
    /// marked <see cref="HallSlotStatus.Booked"/>. Always set (>= the hall's
    /// <see cref="Hall.DayOpenTime"/> and &lt; <see cref="Hall.DayCloseTime">for new-model
    /// bookings. Zero (00:00) means "unset legacy row" and is only possible for dormant
    /// pre-migration data.
    /// </summary>
    public TimeOnly SlotStart { get; set; }

    /// <summary>
    /// Display name the seeker supplies when creating the booking
    /// (FR-HALL hourly-slot booking; seeker-provided). Required for new-model bookings.
    /// </summary>
    public string? NameOnBooking { get; set; }

    public BookingStatus Status { get; set; } = BookingStatus.Pending;

    /// <summary>
    /// True when this booking belongs to the hourly-slot model (WESAL-TASK-1) rather
    /// than the legacy two-period model. <see cref="SlotStart"/> is a non-nullable
    /// column that the hourly migration populated with 00:00 for pre-existing legacy
    /// rows, so a null check cannot discriminate the two models. A real hourly booking
    /// always has a genuine slot time: the hourly window rejects anything before 09:00,
    /// so 00:00 (TimeOnly.MinValue) can only ever mean "legacy row with no hourly slot".
    /// The whole booking lifecycle branches on this flag so an hourly booking releases
    /// its HallSlotAvailability row instead of a legacy two-period row.
    /// </summary>
    public bool IsHourlyBooking => SlotStart != TimeOnly.MinValue;

    /// <summary>
    /// The 60-minute time range this booking occupies, e.g. "10:00 - 11:00", used in
    /// owner/requester-facing messages. Only meaningful for hourly bookings.
    /// </summary>
    public string HourlyTimeRange
        => $"{SlotStart:HH\\:mm} - {SlotStart.AddHours(1):HH\\:mm}";

    public string? RejectionReason { get; set; }

    public Guid? RejectionMessageId { get; set; }
}