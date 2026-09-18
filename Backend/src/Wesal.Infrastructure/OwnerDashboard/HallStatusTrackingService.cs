using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.OwnerDashboard;

/// <summary>
/// Returns the authenticated Hall Owner's own halls with their current approval status
/// (US-OWNER-05). The owner is resolved exclusively from the authenticated session;
/// ownership is enforced by the repository so a caller can never read another owner's
/// halls. Status is read live from the persisted record on every request (no caching),
/// so the owner always sees the current PendingReview/Approved/Rejected state even when
/// an Admin acted in another session.
/// </summary>
public sealed class HallStatusTrackingService : IHallStatusTrackingService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ICurrentUserService _currentUser;
    private readonly IOwnerDashboardRepository _ownerDashboardRepository;

    public HallStatusTrackingService(
        UserManager<ApplicationUser> userManager,
        ICurrentUserService currentUser,
        IOwnerDashboardRepository ownerDashboardRepository)
    {
        _userManager = userManager;
        _currentUser = currentUser;
        _ownerDashboardRepository = ownerDashboardRepository;
    }

    public async Task<IReadOnlyList<OwnerHallDto>> GetOwnedHallsAsync(CancellationToken cancellationToken = default)
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to view your halls.");
        }

        // Validate the account still exists; a token for a deleted account is not a valid owner session.
        var user = await _userManager.FindByIdAsync(_currentUser.UserId);
        if (user is null)
        {
            throw new NotFoundException("User", _currentUser.UserId);
        }

        var halls = await _ownerDashboardRepository.GetOwnedHallsAsync(_currentUser.UserId, cancellationToken);

        return halls
            .Select(hall => new OwnerHallDto
            {
                HallId = hall.Id,
                HallName = hall.Name,
                Status = hall.Status
            })
            .ToList();
    }
}