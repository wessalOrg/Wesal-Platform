using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IHallRepository
{
    Task<IReadOnlyList<Hall>> GetApprovedHallsAsync(int count, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<HallBookingPeriod>> GetBookingPeriodsAsync(
        IReadOnlyCollection<Guid> hallIds,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<HallAvailability>> GetAvailabilityAsync(
        IReadOnlyCollection<Guid> hallIds,
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken = default);
}
