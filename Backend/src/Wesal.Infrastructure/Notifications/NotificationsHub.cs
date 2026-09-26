using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Wesal.Application.Common.Interfaces;

namespace Wesal.Infrastructure.Notifications;

/// <summary>
/// Per-user SignalR hub for platform notifications (WESAL-TASK-13, Edit 13).
/// </summary>
/// <remarks>
/// Follows the same identity-based group pattern as
/// <c>OwnerDashboardHub</c>: a connection joins the group named by its own authenticated
/// user id, and group membership is never client-supplied, so a user can only ever receive
/// notifications addressed to their own account. Notifications are addressed to any role
/// (seeker, Hall Owner or Admin) from one hub, which is why this is separate from the
/// owner-dashboard hub.
/// </remarks>
[Authorize]
public sealed class NotificationsHub : Hub
{
    /// <summary>Client event carrying one fully localized notification.</summary>
    public const string NotificationReceived = "NotificationReceived";

    private readonly ICurrentUserService _currentUser;

    public NotificationsHub(ICurrentUserService currentUser)
    {
        _currentUser = currentUser;
    }

    public async Task JoinNotificationsGroup(CancellationToken cancellationToken = default)
    {
        var userId = ResolveUserId();

        await Groups.AddToGroupAsync(Context.ConnectionId, userId, cancellationToken);
    }

    public async Task LeaveNotificationsGroup(CancellationToken cancellationToken = default)
    {
        var userId = ResolveUserId();

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, userId, cancellationToken);
    }

    private string ResolveUserId()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new HubException("You must be authenticated to receive notifications.");
        }

        return _currentUser.UserId;
    }
}
