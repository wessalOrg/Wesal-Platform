namespace Wesal.Application.Common.Interfaces;

public interface IHallAvailabilityCleanupService
{
    Task<int> CleanupExpiredAsync(CancellationToken cancellationToken = default);
    Task<int> CleanupForHallAsync(Guid hallId, CancellationToken cancellationToken = default);
}
