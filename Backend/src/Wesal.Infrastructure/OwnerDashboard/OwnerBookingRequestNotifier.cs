using Microsoft.AspNetCore.SignalR;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.OwnerDashboard;

/// <summary>
/// Pushes new-booking-request events to the Hall Owner's browser via SignalR
/// (US-OWNER-10). The owner is resolved from trusted backend data
/// (booking.Hall.OwnerId), never from client input. Delivery is best-effort:
/// a failure is swallowed so the booking remains accessible even when the
/// realtime channel is temporarily unavailable.
/// </summary>
public sealed class OwnerBookingRequestNotifier : IOwnerBookingRequestNotifier
{
    private readonly IHubContext<OwnerDashboardHub> _hubContext;

    public OwnerBookingRequestNotifier(IHubContext<OwnerDashboardHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task NotifyBookingRequestReceivedAsync(
        string ownerUserId,
        OwnerBookingRequestNotificationEvent notification,
        CancellationToken cancellationToken = default)
    {
        await _hubContext
            .Clients
            .Group(ownerUserId)
            .SendAsync(OwnerDashboardHub.BookingRequestReceived, notification, cancellationToken);
    }
}
