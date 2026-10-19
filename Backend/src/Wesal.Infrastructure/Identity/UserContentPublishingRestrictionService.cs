using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;

namespace Wesal.Infrastructure.Identity;

/// <summary>
/// Reads the admin restriction timestamp used by the section-16 moderation integration.
/// The restriction management endpoints are outside Tasks 7 and 8.
/// </summary>
public sealed class UserContentPublishingRestrictionService : IUserContentPublishingRestrictionService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly TimeProvider _timeProvider;

    public UserContentPublishingRestrictionService(UserManager<ApplicationUser> userManager, TimeProvider timeProvider)
    {
        _userManager = userManager;
        _timeProvider = timeProvider;
    }

    public async Task<bool> IsRestrictedAsync(string userId, CancellationToken cancellationToken = default)
    {
        var user = await _userManager.FindByIdAsync(userId);
        return user?.ContentPublishingRestrictedUntil is { } until && until > _timeProvider.GetUtcNow();
    }
}
