using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Entities;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.OwnerDashboard;

/// <summary>
/// Returns the incoming booking requests for a hall owned by the authenticated Hall
/// Owner (US-OWNER-09, FR-BOOK-01). The owner is resolved exclusively from the
/// authenticated session; ownership is enforced by the repository so a caller can
/// never read another owner's hall. The read is strictly passive: no booking status,
/// availability, or reservation is ever changed. Competing requests for the same
/// hall/date/period are all returned without deduplication, exactly as persisted.
/// </summary>
public sealed class OwnerBookingRequestsService : IOwnerBookingRequestsService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ICurrentUserService _currentUser;
    private readonly IOwnerDashboardRepository _ownerDashboardRepository;

    public OwnerBookingRequestsService(
        UserManager<ApplicationUser> userManager,
        ICurrentUserService currentUser,
        IOwnerDashboardRepository ownerDashboardRepository)
    {
        _userManager = userManager;
        _currentUser = currentUser;
        _ownerDashboardRepository = ownerDashboardRepository;
    }

    public async Task<IReadOnlyList<OwnerBookingRequestDto>> GetBookingRequestsAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var ownerId = await ResolveOwnerAsync(cancellationToken);

        var hall = await _ownerDashboardRepository.GetOwnedHallAsync(hallId, ownerId, cancellationToken);

        if (hall is null)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        HallManagementAccess.EnsureAllowed(hall);

        var requests = await _ownerDashboardRepository.GetBookingRequestsAsync(hallId, ownerId, cancellationToken);

        if (requests is null)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        return requests;
    }

    private async Task<string> ResolveOwnerAsync(CancellationToken cancellationToken)
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to view booking requests.");
        }

        // Validate the account still exists; a token for a deleted account is not a valid owner session.
        var user = await _userManager.FindByIdAsync(_currentUser.UserId);
        if (user is null)
        {
            throw new NotFoundException("User", _currentUser.UserId);
        }

        return _currentUser.UserId;
    }
}