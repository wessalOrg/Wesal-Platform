using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.Notifications;

/// <summary>
/// Pushes localized notifications to a single recipient's browser via SignalR
/// (WESAL-TASK-13, Edit 13).
/// </summary>
/// <remarks>
/// The recipient is always a user id resolved from trusted backend data (a booking's
/// requester, a hall's owner, an Admin), never from client input. Delivery is
/// best-effort: a realtime failure is swallowed by the callers so that a booking is never
/// rolled back, or an API call failed, purely because a browser was offline. The durable
/// record of a notification that matters (a conversation message) is written separately.
/// </remarks>
public interface INotificationNotifier
{
    Task NotifyAsync(
        string recipientUserId,
        NotificationEvent notification,
        CancellationToken cancellationToken = default);
}
