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

    Task<IReadOnlyList<HallImage>> GetHallImagesAsync(Guid hallId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<HallBookingPeriod>> GetBookingPeriodsAsync(
        IReadOnlyCollection<Guid> hallIds,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<HallAvailability>> GetAvailabilityAsync(
        IReadOnlyCollection<Guid> hallIds,
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken = default);
}
