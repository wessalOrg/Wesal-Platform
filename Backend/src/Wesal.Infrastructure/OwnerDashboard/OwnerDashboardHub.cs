using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Wesal.Application.Common.Interfaces;

namespace Wesal.Infrastructure.OwnerDashboard;

/// <summary>
/// SignalR hub for the Hall Owner dashboard (US-OWNER-10). The owner joins a group
/// identified by their authenticated user ID. When a new booking request arrives for
/// any of their halls, the backend pushes a <see cref="OwnerDashboardHub.BookingRequestReceived"/>
/// event to that group. The owner is resolved from the JWT; group membership is
/// strictly identity-based so an owner can never join another owner's group.
/// </summary>
[Authorize]
public sealed class OwnerDashboardHub : Hub
{
    public const string BookingRequestReceived = "BookingRequestReceived";

    private readonly ICurrentUserService _currentUser;

    public OwnerDashboardHub(ICurrentUserService currentUser)
    {
        _currentUser = currentUser;
    }

    public async Task JoinOwnerGroup(CancellationToken cancellationToken = default)
    {
        var ownerId = ResolveOwnerId();

        await Groups.AddToGroupAsync(Context.ConnectionId, ownerId, cancellationToken);
    }

    public async Task LeaveOwnerGroup(CancellationToken cancellationToken = default)
    {
        var ownerId = ResolveOwnerId();

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, ownerId, cancellationToken);
    }

    private string ResolveOwnerId()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new HubException("You must be authenticated to join the owner dashboard.");
        }

        return _currentUser.UserId;
    }
}
