using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

/// <summary>
/// Result returned after a seeker cancelled their own pending booking request.
/// WESAL-TASK-1: <see cref="Period"/> is only meaningful for a legacy two-period
/// booking; an hourly booking is identified by <see cref="SlotStart"/> with
/// <see cref="IsHourlyBooking"/> set to true, and its released 60-minute slot becomes
/// Available again.
/// </summary>
public class CancelBookingResultDto
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

    public BookingStatus Status { get; init; } = BookingStatus.Cancelled;
}