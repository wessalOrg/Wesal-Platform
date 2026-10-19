using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;

namespace Wesal.Infrastructure.Identity;

/// <summary>
/// Reads the admin restriction timestamp used by the section-16 moderation integration.
/// The restriction management endpoints are outside Tasks 7 and 8.
/// </summary>
public sealed class UserContentPublishingRestrictionService : IUserContentPublishingRestrictionService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly TimeProvider _timeProvider;
    private readonly IUserPublishingRestrictionRepository? _restrictions;

    public UserContentPublishingRestrictionService(UserManager<ApplicationUser> userManager, TimeProvider timeProvider)
        : this(userManager, null, timeProvider)
    {
    }

    public UserContentPublishingRestrictionService(UserManager<ApplicationUser> userManager,
        IUserPublishingRestrictionRepository? restrictions, TimeProvider timeProvider)
    {
        _userManager = userManager;
        _restrictions = restrictions;
        _timeProvider = timeProvider;
    }

    public async Task<bool> IsRestrictedAsync(string userId, CancellationToken cancellationToken = default)
        => await GetRestrictedUntilAsync(userId, cancellationToken) is not null;

    public async Task<DateTimeOffset?> GetRestrictedUntilAsync(string userId, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var now = _timeProvider.GetUtcNow();
        if (_restrictions is not null && await _restrictions.GetActiveEndsAtAsync(userId, now, cancellationToken) is { } end)
            return end;
        var user = await _userManager.FindByIdAsync(userId);
        return user?.ContentPublishingRestrictedUntil is { } until && until > now ? until : null;
    }
}
