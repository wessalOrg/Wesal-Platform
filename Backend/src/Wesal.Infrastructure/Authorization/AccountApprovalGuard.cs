using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Constants;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Authorization;

/// <summary>
/// The account-level publishing gate (WESAL approval enforcement).
///
/// An Event Coordinator or Photographer whose approval status is not <c>Approved</c>
/// must not create or edit user-generated content. Every other account type —
/// ordinary registered users, hall owners, and administrators — passes untouched, so
/// the rule narrows exactly the two roles the specification names and nothing else.
///
/// The check reads the live account state from the database (never a possibly-stale
/// token claim), so an approval or rejection takes effect on the very next request.
/// A caller whose account cannot be resolved fails closed with the standard 403
/// exception rather than being silently allowed to publish.
/// </summary>
public sealed class AccountApprovalGuard : IAccountApprovalGuard
{
    private const string PublishingBlockedMessage =
        "Your account must be approved by an administrator before you can publish content.";

    private readonly ICurrentUserService _currentUser;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IAccountLockService? _accountLocks;

    public AccountApprovalGuard(
        ICurrentUserService currentUser,
        UserManager<ApplicationUser> userManager,
        IAccountLockService? accountLocks = null)
    {
        _currentUser = currentUser;
        _userManager = userManager;
        _accountLocks = accountLocks;
    }

    public async Task EnsureCanPublishAsync(CancellationToken cancellationToken = default)
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to publish content.");
        }

        if (!IsApprovalRestrictedRole(_currentUser.Roles))
        {
            return;
        }

        var user = await _userManager.FindByIdAsync(_currentUser.UserId);
        if (user is null || user.ApprovalStatus != AccountApprovalStatus.Approved)
        {
            throw new ForbiddenException(PublishingBlockedMessage);
        }
        if (_accountLocks is not null)
            await _accountLocks.EnsureUnlockedAsync(user.Id, cancellationToken);
    }

    public async Task EnsureUserCanPublishAsync(string userId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
        {
            throw new UnauthorizedException("You must be logged in to publish content.");
        }

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
        {
            throw new ForbiddenException(PublishingBlockedMessage);
        }

        if (!await IsApprovalRestrictedUserAsync(user, cancellationToken))
        {
            return;
        }

        if (user.ApprovalStatus != AccountApprovalStatus.Approved)
        {
            throw new ForbiddenException(PublishingBlockedMessage);
        }
        if (_accountLocks is not null)
            await _accountLocks.EnsureUnlockedAsync(user.Id, cancellationToken);
    }

    private async Task<bool> IsApprovalRestrictedUserAsync(ApplicationUser user, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        return await _userManager.IsInRoleAsync(user, ApplicationRoles.EventCoordinator)
            || await _userManager.IsInRoleAsync(user, ApplicationRoles.Photographer);
    }

    /// <summary>
    /// True when the given role list names an approval-restricted role. Uses the roles
    /// already on the authenticated principal, so the common pass-through case (every
    /// ordinary user) costs no database round-trip.
    /// </summary>
    private static bool IsApprovalRestrictedRole(IReadOnlyList<string> roles)
        => roles.Contains(ApplicationRoles.EventCoordinator, StringComparer.OrdinalIgnoreCase)
        || roles.Contains(ApplicationRoles.Photographer, StringComparer.OrdinalIgnoreCase);
}
