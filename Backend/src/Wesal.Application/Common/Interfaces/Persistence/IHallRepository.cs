using Wesal.Domain.Entities;
using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IHallRepository
{
    Task<Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Hall>> GetApprovedHallsAsync(int count, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Hall>> GetApprovedHallsByRegionAsync(
        HallRegion region,
        int count,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Hall>> GetApprovedHallsPaginatedAsync(
        int skip,
        int take,
        CancellationToken cancellationToken = default);

    Task<int> GetApprovedHallsCountAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Hall>> SearchApprovedHallsAsync(
        string? name,
        HallRegion? region,
        string? area,
        DateOnly? date,
        TimeOnly? startTime,
        int skip,
        int take,
        CancellationToken cancellationToken = default);

    Task<int> SearchApprovedHallsCountAsync(
        string? name,
        HallRegion? region,
        string? area,
        DateOnly? date,
        TimeOnly? startTime,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<HallImage>> GetHallImagesAsync(Guid hallId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<HallFeature>> GetHallFeaturesAsync(
        IReadOnlyCollection<Guid> hallIds,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult<IReadOnlyList<HallFeature>>(Array.Empty<HallFeature>());
    }

    /// <summary>
    /// The hourly slot reservations for the given halls and date window, used to decide
    /// whether a hall is free on a date/hour. A hall with no rows is free.
    /// </summary>
    Task<IReadOnlyList<HallSlotAvailability>> GetSlotAvailabilitiesAsync(
        IReadOnlyCollection<Guid> hallIds,
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult<IReadOnlyList<HallSlotAvailability>>(Array.Empty<HallSlotAvailability>());
    }

    /// <summary>
    /// WESAL-TASK-1 hardening: the halls in <paramref name="hallIds"/> whose owner blocked
    /// at least one day in the range. Default implementation reports "nothing blocked" so
    /// the many lightweight test doubles of this interface keep compiling unchanged.
    /// </summary>
    Task<IReadOnlySet<Guid>> GetBlockedDayHallIdsAsync(
        IReadOnlyCollection<Guid> hallIds,
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult<IReadOnlySet<Guid>>(new HashSet<Guid>());
    }

    /// <summary>
    /// WESAL-TASK-1 hardening: the specific dates inside the range that the owner blocked
    /// for this one hall. Per-date granularity is needed by the hall-details availability
    /// window, which projects a handful of days and must mark each blocked one. Default
    /// implementation reports "nothing blocked" so existing test doubles keep compiling.
    /// </summary>
    Task<IReadOnlySet<DateOnly>> GetBlockedDatesAsync(
        Guid hallId,
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult<IReadOnlySet<DateOnly>>(new HashSet<DateOnly>());
    }

    Task AddAsync(Hall hall, CancellationToken cancellationToken = default)
    {
        return Task.CompletedTask;
    }

    Task<Hall?> GetHallByIdForUpdateAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return Task.FromResult<Hall?>(null);
    }
}
