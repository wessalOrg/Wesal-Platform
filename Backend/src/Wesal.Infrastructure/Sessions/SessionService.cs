using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.Infrastructure.Sessions;

public sealed class SessionService : ISessionService
{
    private readonly ICurrentUserService _currentUser;
    private readonly IOwnerDashboardRepository _ownerDashboardRepository;

    public SessionService(
        ICurrentUserService currentUser,
        IOwnerDashboardRepository ownerDashboardRepository)
    {
        _currentUser = currentUser;
        _ownerDashboardRepository = ownerDashboardRepository;
    }

    public async Task<SessionResponse> GetSessionAsync(CancellationToken cancellationToken = default)
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            return new SessionResponse
            {
                IsAuthenticated = false,
                Role = null,
                UserName = null,
                IsHallOwner = false,
                OwnsHall = false
            };
        }

        var role = DeterminePrimaryRole(_currentUser.Roles);
        var isHallOwner = _currentUser.Roles.Contains(ApplicationRoles.HallOwner, StringComparer.OrdinalIgnoreCase);

        // Edit 19: hall ownership is counted live from the database for the
        // authenticated user id, never taken from client input. Guests and users
        // without an id own nothing by construction.
        var hasHall = await _ownerDashboardRepository.GetHallCountByOwnerAsync(
            _currentUser.UserId, cancellationToken) > 0;

        return new SessionResponse
        {
            IsAuthenticated = true,
            Role = role,
            UserName = _currentUser.UserName,
            IsHallOwner = isHallOwner,
            OwnsHall = hasHall
        };
    }

    private static string? DeterminePrimaryRole(IReadOnlyList<string> roles)
    {
        if (roles.Count == 0)
        {
            return null;
        }

        if (roles.Contains(ApplicationRoles.Admin, StringComparer.OrdinalIgnoreCase))
        {
            return ApplicationRoles.Admin;
        }

        if (roles.Contains(ApplicationRoles.HallOwner, StringComparer.OrdinalIgnoreCase))
        {
            return ApplicationRoles.HallOwner;
        }

        if (roles.Contains(ApplicationRoles.RegisteredUser, StringComparer.OrdinalIgnoreCase))
        {
            return ApplicationRoles.RegisteredUser;
        }

        return roles[0];
    }
}
