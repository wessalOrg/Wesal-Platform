namespace Wesal.Application.Common.Models;

/// <summary>
/// Realtime event pushed to the Hall Owner when a seeker cancels one of their own
/// booking requests (WESAL-TASK-1). It carries exactly what the owner must be told:
/// the requester's name, that the request was cancelled, and the affected date and
/// hourly time. For an hourly booking <see cref="SlotStart"/> carries the real slot;
/// for a legacy two-period booking it is left at its default and
/// <see cref="RequestedPeriod"/> is the meaningful field. The owner id is resolved from
/// trusted backend data (booking.Hall.OwnerId), never from client input.
/// </summary>
public sealed class OwnerBookingCancellationNotificationEvent
{
    public Guid BookingId { get; init; }

    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public DateOnly Date { get; init; }

    /// <summary>The cancelled hourly slot start; 00:00 for a legacy two-period booking.</summary>
    public TimeOnly SlotStart { get; init; }

    /// <summary>The rendered hourly range (e.g. "10:00 - 11:00"); empty for a legacy booking.</summary>
    public string TimeRange { get; init; } = string.Empty;

    public Domain.Enums.BookingPeriodType RequestedPeriod { get; init; }

    public bool IsHourlyBooking { get; init; }

    public string RequesterUserId { get; init; } = string.Empty;

    /// <summary>The name the seeker gave for this booking, falling back to their profile name.</summary>
    public string RequesterName { get; init; } = string.Empty;

    public string EventType { get; init; } = "BookingRequestCancelled";

    public DateTimeOffset OccurredAt { get; init; }
}
