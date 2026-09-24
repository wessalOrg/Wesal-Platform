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
    /// True once the Hall Owner has published the accepted booking's period as
    /// Booked (US-OWNER-13). A booking can only be published while Accepted;
    /// publishing permanently marks the requested HallAvailability as Booked and
    /// is irreversible in this model.
    /// </summary>
    public bool IsPublished { get; set; }

    public string? RejectionReason { get; set; }

    public Guid? RejectionMessageId { get; set; }
}