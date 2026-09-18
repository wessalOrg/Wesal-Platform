using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

/// <summary>
/// Realtime event emitted to the Hall Owner after a new booking request has been
/// successfully persisted (US-OWNER-10). The event is delivered best-effort via
/// SignalR; a delivery failure never rolls back the booking. The owner is resolved
/// from the trusted backend data (booking.Hall.OwnerId), never from client input.
/// </summary>
public sealed class OwnerBookingRequestNotificationEvent
{
    public Guid BookingRequestId { get; init; }

    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public DateOnly RequestedDate { get; init; }

    public BookingPeriodType RequestedPeriod { get; init; }

    public string RequesterUserId { get; init; } = string.Empty;

    public string RequesterName { get; init; } = string.Empty;

    public string EventType { get; init; } = "BookingRequestReceived";

    public DateTimeOffset OccurredAt { get; init; }
}
