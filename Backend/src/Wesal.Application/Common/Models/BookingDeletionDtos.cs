using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

/// <summary>
/// Result returned after the Hall Owner has permanently deleted a booking from
/// their hall's schedule (US-OWNER-15). The booking row is removed and the exact unit
/// it held becomes Available again when no other active booking claims it. WESAL-TASK-1:
/// for an hourly booking that unit is its 60-minute HallSlotAvailability slot, which
/// also clears the public 'Booked' status, so <see cref="Period"/> is only meaningful
/// for a legacy two-period booking. Status echoes the last persisted state of the
/// deleted booking.
/// </summary>
public class DeleteBookingResultDto
{
    public Guid BookingId { get; init; }

    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public string RequesterUserId { get; init; } = string.Empty;

    public DateOnly Date { get; init; }

    /// <summary>Legacy two-period key; meaningless (FirstPeriod) for an hourly booking.</summary>
    public BookingPeriodType Period { get; init; }

    /// <summary>Start of the released 60-minute slot; 00:00 for a legacy two-period booking.</summary>
    public TimeOnly SlotStart { get; init; }

    /// <summary>True when this booking used the hourly-slot model rather than two periods.</summary>
    public bool IsHourlyBooking { get; init; }

    public BookingStatus Status { get; init; }
}