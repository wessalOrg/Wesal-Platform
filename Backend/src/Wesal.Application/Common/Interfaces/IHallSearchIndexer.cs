using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IHallSearchIndexer
{
    Task IndexHallAsync(HallSearchIndexDto hall, CancellationToken cancellationToken = default);
    Task<bool> IsIndexedAsync(Guid hallId, CancellationToken cancellationToken = default);
    Task RetryPendingAsync(CancellationToken cancellationToken = default);
}
