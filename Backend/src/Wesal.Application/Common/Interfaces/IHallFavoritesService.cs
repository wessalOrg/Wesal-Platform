namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// The authenticated user's saved halls ("المفضلة"). Access is gated by the
/// RequireAuthenticatedUser policy, and the owner is resolved from the session so a caller
/// can only ever read or change their own favorites.
/// </summary>
public interface IHallFavoritesService
{
    /// <summary>The current user's favorited hall ids, most recently saved first.</summary>
    Task<IReadOnlyList<Guid>> ListFavoriteHallIdsAsync(CancellationToken cancellationToken = default);

    /// <summary>Saves a hall. Idempotent; throws NotFoundException when the hall does not exist.</summary>
    Task AddAsync(Guid hallId, CancellationToken cancellationToken = default);

    /// <summary>Removes a saved hall. Idempotent.</summary>
    Task RemoveAsync(Guid hallId, CancellationToken cancellationToken = default);
}
