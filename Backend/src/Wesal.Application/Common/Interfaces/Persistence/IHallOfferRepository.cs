using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IHallOfferRepository
{
    Task AddAsync(HallOffer offer, CancellationToken cancellationToken = default);
    Task LockHallForOfferAsync(Guid hallId, CancellationToken cancellationToken = default);
    Task<HallOffer?> GetForUpdateAsync(Guid hallId, Guid offerId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<HallOffer>> ListOwnAsync(Guid hallId, int skip, int take, CancellationToken cancellationToken = default);
    Task<int> CountOwnAsync(Guid hallId, CancellationToken cancellationToken = default);
    Task<HallOffer?> GetActiveForHallAsync(Guid hallId, DateTimeOffset now, CancellationToken cancellationToken = default);
    Task<bool> HasOverlappingAsync(Guid hallId, DateTimeOffset startsAt, DateTimeOffset endsAt, DateTimeOffset now, Guid? exceptId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<HallOffer>> GetExpiredUnprocessedAsync(DateTimeOffset now, CancellationToken cancellationToken = default);
    Task MarkExpiredForHallAsync(Guid hallId, DateTimeOffset now, CancellationToken cancellationToken = default);
    Task<bool> TryClaimExpiryAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken = default);
}
