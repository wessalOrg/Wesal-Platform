using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

/// <summary>
/// Result returned after a booking request has been successfully accepted by the
/// Hall Owner (US-OWNER-11).
///
/// WESAL-TASK-1: acceptance is the publish step. For an hourly booking the 60-minute
/// slot is marked Booked in the same transaction as the approval, so there is no second
/// owner action and no IsPublished flag. <see cref="Period"/> is therefore only
/// meaningful for a legacy two-period booking; an hourly booking is identified by
/// <see cref="SlotStart"/> with <see cref="IsHourlyBooking"/> set to true.
/// </summary>
public class AcceptBookingResultDto
{
    public Guid BookingId { get; init; }

    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public string RequesterUserId { get; init; } = string.Empty;

    public DateOnly Date { get; init; }

    /// <summary>Legacy two-period key; meaningless (FirstPeriod) for an hourly booking.</summary>
    public BookingPeriodType Period { get; init; }

    /// <summary>Start of the booked 60-minute slot; 00:00 for a legacy two-period booking.</summary>
    public TimeOnly SlotStart { get; init; }

    /// <summary>True when this booking uses the hourly-slot model rather than two periods.</summary>
    public bool IsHourlyBooking { get; init; }

    public BookingStatus Status { get; init; } = BookingStatus.Accepted;
}
