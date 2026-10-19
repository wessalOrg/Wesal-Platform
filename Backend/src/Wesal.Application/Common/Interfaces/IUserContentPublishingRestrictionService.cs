namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Minimal integration point for section-16 user restriction checks.
/// Task 8 consumes the current restriction state; management endpoints remain outside scope.
/// </summary>
public interface IUserContentPublishingRestrictionService
{
    /// <summary>
    /// Returns true if the given user is currently restricted from publishing or editing content.
    /// </summary>
    Task<bool> IsRestrictedAsync(string userId, CancellationToken cancellationToken = default);

    async Task<DateTimeOffset?> GetRestrictedUntilAsync(string userId, CancellationToken cancellationToken = default)
        => await IsRestrictedAsync(userId, cancellationToken) ? DateTimeOffset.MaxValue : null;
}
