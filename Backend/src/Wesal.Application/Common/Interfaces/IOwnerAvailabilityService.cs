using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IOwnerAvailabilityService
{
    Task<OwnerAvailabilityCalendarDto> GetAvailabilityAsync(Guid hallId, DateOnly fromDate, DateOnly toDate, CancellationToken cancellationToken = default);
    Task<OwnerAvailabilityPeriodDto> UpdateAvailabilityAsync(Guid hallId, UpdateOwnerAvailabilityRequest request, CancellationToken cancellationToken = default);
}
