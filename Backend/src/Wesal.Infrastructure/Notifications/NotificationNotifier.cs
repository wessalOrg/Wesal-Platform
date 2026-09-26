using Microsoft.AspNetCore.SignalR;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.Notifications;

public sealed class NotificationNotifier : INotificationNotifier
{
    private readonly IHubContext<NotificationsHub> _hubContext;

    public NotificationNotifier(IHubContext<NotificationsHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task NotifyAsync(
        string recipientUserId,
        NotificationEvent notification,
        CancellationToken cancellationToken = default)
    {
        await _hubContext
            .Clients
            .Group(recipientUserId)
            .SendAsync(NotificationsHub.NotificationReceived, notification, cancellationToken);
    }
}
