using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.OwnerDashboard;

/// <summary>
/// Returns the current subscription state of a hall owned by the authenticated Hall
/// Owner (US-OWNER-17, FR-HALL-05). The owner is resolved exclusively from the
/// authenticated session and ownership is enforced by the repository, so a caller can
/// never read another owner's hall. The status is computed fresh on every request
/// from the persisted record (never cached) so the owner always sees the current
/// Active / Payment Pending / Expired / Locked state and the relevant billing date
/// even when an Admin confirmed a payment or locked the hall in another session.
/// This endpoint is strictly read-only: it never changes payment, approval or lock
/// state and never starts a subscription cycle.
/// </summary>
public sealed class HallSubscriptionService : IHallSubscriptionService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ICurrentUserService _currentUser;
    private readonly IOwnerDashboardRepository _ownerDashboardRepository;
    private readonly IDateTime _dateTime;

    public HallSubscriptionService(
        UserManager<ApplicationUser> userManager,
        ICurrentUserService currentUser,
        IOwnerDashboardRepository ownerDashboardRepository,
        IDateTime dateTime)
    {
        _userManager = userManager;
        _currentUser = currentUser;
        _ownerDashboardRepository = ownerDashboardRepository;
        _dateTime = dateTime;
    }

    public async Task<OwnerHallSubscriptionDto> GetHallSubscriptionAsync(
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

        var today = DateOnly.FromDateTime(_dateTime.Now.UtcDateTime);

        return new OwnerHallSubscriptionDto
        {
            HallId = hall.Id,
            HallName = hall.Name,
            Status = ComputeStatus(hall, today, out var nextBillingDate),
            NextBillingDate = nextBillingDate
        };
    }

    /// <summary>
    /// Derives the live subscription state from the persisted hall record alone.
    /// A hall is paid whenever its 30-day cycle end is set (FR-SUB-01: payment
    /// confirmation starts the cycle), so no separate payment-status flag is needed
    /// and the two persisted fields can never drift apart. A lapsed cycle end
    /// (FR-SUB-03 system-lock) is surfaced as Expired with the lapsed cycle end as the
    /// next billing date, matching the SRS "relevant date" display.
    /// </summary>
    private static HallSubscriptionStatus ComputeStatus(
        Hall hall,
        DateOnly today,
        out DateOnly? nextBillingDate)
    {
        // A manual Admin lock (FR-SUB-05) restricts access regardless of payment or
        // approval status; it dominates the display. The billing date still applies
        // when the hall has a paid cycle, and is absent when it has never been paid.
        if (hall.IsAdminLocked)
        {
            nextBillingDate = hall.SubscriptionCycleEnd;
            return HallSubscriptionStatus.Locked;
        }

        // Pending Review (and Rejected) halls have no active subscription cycle yet:
        // payment only activates after approval (FR-SUB-01). Shown as payment-pending
        // with no billing date.
        if (hall.Status != HallStatus.Approved)
        {
            nextBillingDate = null;
            return HallSubscriptionStatus.PaymentPending;
        }

        // Approved but unpaid: no confirmed payment and no cycle (FR-SUB-01/FR-ADM-03
        // keep approval and payment independent). Payment-pending, no billing date.
        if (hall.SubscriptionCycleEnd is null)
        {
            nextBillingDate = null;
            return HallSubscriptionStatus.PaymentPending;
        }

        // An active paid cycle: the hall is online until its next billing date.
        if (hall.SubscriptionCycleEnd >= today)
        {
            nextBillingDate = hall.SubscriptionCycleEnd;
            return HallSubscriptionStatus.Active;
        }

        // The paid cycle ended without renewal: system-locked for non-payment
        // (FR-SUB-03). The lapsed cycle end is the relevant (next billing) date.
        nextBillingDate = hall.SubscriptionCycleEnd;
        return HallSubscriptionStatus.Expired;
    }

    private async Task<string> ResolveOwnerAsync(CancellationToken cancellationToken)
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to view your hall's subscription.");
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