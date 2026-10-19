using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IHallOfferService
{
    Task<Guid> CreateAsync(Guid hallId, CreateHallOfferRequest request, CancellationToken cancellationToken = default);
    Task UpdateAsync(Guid hallId, Guid offerId, UpdateHallOfferRequest request, CancellationToken cancellationToken = default);
    Task StopAsync(Guid hallId, Guid offerId, CancellationToken cancellationToken = default);
    Task<PagedResult<HallOfferDto>> ListOwnAsync(Guid hallId, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<HallOfferDto?> GetActiveForHallAsync(Guid hallId, CancellationToken cancellationToken = default);
}
