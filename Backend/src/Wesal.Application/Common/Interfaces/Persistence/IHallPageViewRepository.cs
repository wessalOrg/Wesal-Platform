namespace Wesal.Application.Common.Interfaces.Persistence;

/// <summary>Persists and aggregates public hall-details page view events.</summary>
public interface IHallPageViewRepository
{
    Task AddAsync(Guid hallId, DateTimeOffset viewedAt, CancellationToken cancellationToken = default);

    /// <summary>
    /// Counts view events for the given halls whose <c>ViewedAt</c> falls in
    /// [<paramref name="fromInclusive"/>, <paramref name="toExclusive"/>).
    /// Returns 0 when <paramref name="hallIds"/> is empty.
    /// </summary>
    Task<int> CountForHallsInRangeAsync(
        IReadOnlyCollection<Guid> hallIds,
        DateTimeOffset fromInclusive,
        DateTimeOffset toExclusive,
        CancellationToken cancellationToken = default);
}
