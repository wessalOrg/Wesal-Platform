using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public sealed class HallPageViewRepository(ApplicationDbContext db) : IHallPageViewRepository
{
    public async Task AddAsync(Guid hallId, DateTimeOffset viewedAt, CancellationToken cancellationToken = default)
    {
        db.HallPageViewEvents.Add(new HallPageViewEvent
        {
            Id = Guid.NewGuid(),
            HallId = hallId,
            ViewedAt = viewedAt
        });
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<int> CountForHallsInRangeAsync(
        IReadOnlyCollection<Guid> hallIds,
        DateTimeOffset fromInclusive,
        DateTimeOffset toExclusive,
        CancellationToken cancellationToken = default)
    {
        if (hallIds.Count == 0)
        {
            return 0;
        }

        return await db.HallPageViewEvents
            .AsNoTracking()
            .CountAsync(
                view => hallIds.Contains(view.HallId)
                    && view.ViewedAt >= fromInclusive
                    && view.ViewedAt < toExclusive,
                cancellationToken);
    }
}
