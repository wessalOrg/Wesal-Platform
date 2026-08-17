using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.Infrastructure.Sessions;

public sealed class SessionService : ISessionService
{
    private readonly ICurrentUserService _currentUser;

    public SessionService(ICurrentUserService currentUser)
    {
        _currentUser = currentUser;
    }

    public SessionResponse GetSession()
    {
        if (!_currentUser.IsAuthenticated)
        {
            return new SessionResponse
            {
                IsAuthenticated = false,
                Role = null,
                UserName = null
            };
        }

        var role = DeterminePrimaryRole(_currentUser.Roles);

        return new SessionResponse
        {
            IsAuthenticated = true,
            Role = role,
            UserName = _currentUser.UserName
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
