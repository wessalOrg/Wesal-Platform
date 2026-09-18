using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.OwnerDashboard;

public sealed class OwnerSidebarService : IOwnerSidebarService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ICurrentUserService _currentUser;
    private readonly IOwnerDashboardRepository _ownerDashboardRepository;

    public OwnerSidebarService(
        UserManager<ApplicationUser> userManager,
        ICurrentUserService currentUser,
        IOwnerDashboardRepository ownerDashboardRepository)
    {
        _userManager = userManager;
        _currentUser = currentUser;
        _ownerDashboardRepository = ownerDashboardRepository;
    }

    public async Task<OwnerSidebarResponse> GetSidebarAsync(CancellationToken cancellationToken = default)
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to access the management interface.");
        }

        // Validate the account still exists; a token for a deleted account is not a valid owner session.
        var user = await _userManager.FindByIdAsync(_currentUser.UserId);
        if (user is null)
        {
            throw new NotFoundException("User", _currentUser.UserId);
        }

        var hallCount = await _ownerDashboardRepository.GetHallCountByOwnerAsync(_currentUser.UserId, cancellationToken);

        return new OwnerSidebarResponse
        {
            InterfaceType = OwnerInterfaceTypes.HallOwnerManagement,
            Sections =
            [
                new OwnerSidebarSectionDto
                {
                    Key = OwnerSidebarSections.Profile,
                    Label = "Profile",
                    Order = 0,
                    IsDefault = true
                },
                new OwnerSidebarSectionDto
                {
                    Key = OwnerSidebarSections.MyHalls,
                    Label = "My Halls",
                    Order = 1,
                    IsDefault = false,
                    BadgeCount = hallCount
                }
            ]
        };
    }
}