using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public sealed class HallFavoriteRepository(ApplicationDbContext db) : IHallFavoriteRepository
{
    public Task<bool> ExistsAsync(string userId, Guid hallId, CancellationToken cancellationToken = default)
        => db.HallFavorites.AnyAsync(
            favorite => favorite.UserId == userId && favorite.HallId == hallId,
            cancellationToken);

    public async Task AddAsync(string userId, Guid hallId, DateTimeOffset createdAt, CancellationToken cancellationToken = default)
    {
        // Idempotent: saving a hall twice is a no-op rather than a unique-constraint failure.
        if (await ExistsAsync(userId, hallId, cancellationToken)) return;

        db.HallFavorites.Add(new HallFavorite
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            HallId = hallId,
            CreatedAt = createdAt
        });
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<bool> RemoveAsync(string userId, Guid hallId, CancellationToken cancellationToken = default)
    {
        var favorite = await db.HallFavorites.FirstOrDefaultAsync(
            row => row.UserId == userId && row.HallId == hallId,
            cancellationToken);
        if (favorite is null) return false;

        db.HallFavorites.Remove(favorite);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<IReadOnlyList<Guid>> ListHallIdsAsync(string userId, CancellationToken cancellationToken = default)
        => await db.HallFavorites
            .AsNoTracking()
            .Where(favorite => favorite.UserId == userId)
            .OrderByDescending(favorite => favorite.CreatedAt)
            .ThenByDescending(favorite => favorite.HallId)
            .Select(favorite => favorite.HallId)
            .ToListAsync(cancellationToken);
}
