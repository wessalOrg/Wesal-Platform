namespace Wesal.Application.Common.Models;

/// <summary>
/// Realtime event pushed to the Hall Owner when a seeker cancels one of their own
/// booking requests (WESAL-TASK-1). It carries the affected date and the
/// hourly slots released by the cancellation. The owner id is resolved from
/// trusted backend data (booking.Hall.OwnerId), never from client input.
/// </summary>
public sealed class OwnerBookingCancellationNotificationEvent
{
    public Guid BookingId { get; init; }

    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public DateOnly Date { get; init; }

    public IReadOnlyList<TimeOnly> SlotStarts { get; init; } = [];

    public string TimeRange { get; init; } = string.Empty;

    public string RequesterUserId { get; init; } = string.Empty;

    /// <summary>The name the seeker gave for this booking, falling back to their profile name.</summary>
    public string RequesterName { get; init; } = string.Empty;

    public string EventType { get; init; } = "BookingRequestCancelled";

    public DateTimeOffset OccurredAt { get; init; }
}
