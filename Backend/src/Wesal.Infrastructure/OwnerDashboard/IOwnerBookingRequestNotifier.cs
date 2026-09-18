using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.OwnerDashboard;

/// <summary>
/// Delivers realtime booking-request notifications to the Hall Owner after a new
/// booking has been successfully persisted (US-OWNER-10). Delivery is best-effort:
/// a failure must never roll back the booking or cause the API to report an error.
/// The target owner is resolved from trusted backend data (booking.Hall.OwnerId),
/// never from client-supplied input.
/// </summary>
public interface IOwnerBookingRequestNotifier
{
    Task NotifyBookingRequestReceivedAsync(
        string ownerUserId,
        OwnerBookingRequestNotificationEvent notification,
        CancellationToken cancellationToken = default);
}
