using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

/// <summary>
/// Result returned after a booking request has been successfully accepted by the
/// Hall Owner (US-OWNER-11). Acceptance marks the booking's hourly
/// slots as booked in the same transaction, so there is no second owner action.
/// </summary>
public class AcceptBookingResultDto
{
    public Guid BookingId { get; init; }

    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public string RequesterUserId { get; init; } = string.Empty;

    public DateOnly Date { get; init; }

    public IReadOnlyList<TimeOnly> SlotStarts { get; init; } = [];

    public string TimeRange { get; init; } = string.Empty;

    public BookingStatus Status { get; init; } = BookingStatus.Accepted;
}
