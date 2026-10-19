using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public sealed class HallOfferRepository(ApplicationDbContext context) : IHallOfferRepository
{
    public async Task AddAsync(HallOffer offer, CancellationToken cancellationToken = default)
        => await context.HallOffers.AddAsync(offer, cancellationToken);

    public async Task LockHallForOfferAsync(Guid hallId, CancellationToken cancellationToken = default)
        => _ = await context.Halls.FromSqlInterpolated($"SELECT * FROM wesal.\"Halls\" WHERE \"Id\" = {hallId} FOR UPDATE")
            .IgnoreQueryFilters().Select(hall => hall.Id).SingleAsync(cancellationToken);

    public Task<HallOffer?> GetForUpdateAsync(Guid hallId, Guid offerId, CancellationToken cancellationToken = default)
        => context.HallOffers.FirstOrDefaultAsync(offer => offer.HallId == hallId && offer.Id == offerId, cancellationToken);

    public async Task<IReadOnlyList<HallOffer>> ListOwnAsync(Guid hallId, int skip, int take, CancellationToken cancellationToken = default)
        => await context.HallOffers.AsNoTracking().Include(offer => offer.Hall)
            .Where(offer => offer.HallId == hallId).OrderByDescending(offer => offer.CreatedAt).ThenBy(offer => offer.Id)
            .Skip(skip).Take(take).ToListAsync(cancellationToken);

    public Task<int> CountOwnAsync(Guid hallId, CancellationToken cancellationToken = default)
        => context.HallOffers.CountAsync(offer => offer.HallId == hallId, cancellationToken);

    public Task<HallOffer?> GetActiveForHallAsync(Guid hallId, DateTimeOffset now, CancellationToken cancellationToken = default)
        => Active(now).Where(offer => offer.HallId == hallId).Include(offer => offer.Hall).FirstOrDefaultAsync(cancellationToken);

    public Task<bool> HasOverlappingAsync(Guid hallId, DateTimeOffset startsAt, DateTimeOffset endsAt, DateTimeOffset now, Guid? exceptId = null, CancellationToken cancellationToken = default)
        => context.HallOffers.AnyAsync(offer => offer.HallId == hallId && offer.Id != exceptId
            && offer.StoppedAt == null && offer.ExpiredProcessedAt == null && offer.EndsAt > now
            && offer.StartsAt < endsAt && startsAt < offer.EndsAt, cancellationToken);

    public async Task<IReadOnlyList<HallOffer>> GetExpiredUnprocessedAsync(DateTimeOffset now, CancellationToken cancellationToken = default)
        => await context.HallOffers.AsNoTracking().Where(offer => offer.EndsAt <= now && offer.ExpiredProcessedAt == null && offer.StoppedAt == null)
            .OrderBy(offer => offer.EndsAt).Take(500).ToListAsync(cancellationToken);

    public async Task MarkExpiredForHallAsync(Guid hallId, DateTimeOffset now, CancellationToken cancellationToken = default)
        => await context.HallOffers.Where(offer => offer.HallId == hallId && offer.EndsAt <= now
                && offer.ExpiredProcessedAt == null && offer.StoppedAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(offer => offer.ExpiredProcessedAt, now), cancellationToken);

    public async Task<bool> TryClaimExpiryAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken = default)
        => await context.HallOffers.Where(offer => offer.Id == id && offer.EndsAt <= now
            && offer.ExpiredProcessedAt == null && offer.StoppedAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(offer => offer.ExpiredProcessedAt, now), cancellationToken) == 1;

    private IQueryable<HallOffer> Active(DateTimeOffset now)
        => context.HallOffers.AsNoTracking().Where(offer => offer.StoppedAt == null
            && offer.ExpiredProcessedAt == null && offer.StartsAt <= now && now < offer.EndsAt
            && context.Halls.Any(hall => hall.Id == offer.HallId && hall.Status == HallStatus.Approved
                && !hall.IsDeleted && !hall.IsAdminLocked && !hall.SystemLocked && hall.PaymentStatus == HallPaymentStatus.Paid));
}
