namespace Wesal.Application.Common.Interfaces.Persistence;

/// <summary>Persists the halls a user saved to their favorites ("المفضلة").</summary>
public interface IHallFavoriteRepository
{
    Task<bool> ExistsAsync(string userId, Guid hallId, CancellationToken cancellationToken = default);

    Task AddAsync(string userId, Guid hallId, DateTimeOffset createdAt, CancellationToken cancellationToken = default);

    /// <summary>Removes the favorite if present; returns whether a row was actually removed.</summary>
    Task<bool> RemoveAsync(string userId, Guid hallId, CancellationToken cancellationToken = default);

    /// <summary>The favorited hall ids for a user, most recently saved first.</summary>
    Task<IReadOnlyList<Guid>> ListHallIdsAsync(string userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Counts favorites for the given halls whose <c>CreatedAt</c> falls in
    /// [<paramref name="fromInclusive"/>, <paramref name="toExclusive"/>).
    /// Returns 0 when <paramref name="hallIds"/> is empty.
    /// </summary>
    Task<int> CountForHallsInRangeAsync(
        IReadOnlyCollection<Guid> hallIds,
        DateTimeOffset fromInclusive,
        DateTimeOffset toExclusive,
        CancellationToken cancellationToken = default);
}
