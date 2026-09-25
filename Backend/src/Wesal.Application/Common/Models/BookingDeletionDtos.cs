using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

/// <summary>
/// Result returned after the Hall Owner has permanently deleted a booking from
/// their hall's schedule (US-OWNER-15). The booking row is removed and its
/// hourly slots become available again when no other active booking
/// claims them. Status echoes the last persisted state of the deleted booking.
/// </summary>
public class DeleteBookingResultDto
{
    public Guid BookingId { get; init; }

    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public string RequesterUserId { get; init; } = string.Empty;

    public DateOnly Date { get; init; }

    public IReadOnlyList<TimeOnly> SlotStarts { get; init; } = [];

    public string TimeRange { get; init; } = string.Empty;

    public BookingStatus Status { get; init; }
}