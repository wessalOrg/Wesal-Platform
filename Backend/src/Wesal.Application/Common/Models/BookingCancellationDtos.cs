using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

/// <summary>
/// Result returned after a seeker cancelled their own pending booking request.
/// The hourly slots released by the cancellation become available
/// again.
/// </summary>
public class CancelBookingResultDto
{
    public Guid BookingId { get; init; }

    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public string RequesterUserId { get; init; } = string.Empty;

    public DateOnly Date { get; init; }

    public IReadOnlyList<TimeOnly> SlotStarts { get; init; } = [];

    public string TimeRange { get; init; } = string.Empty;

    public BookingStatus Status { get; init; } = BookingStatus.Cancelled;
}