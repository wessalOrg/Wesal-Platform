using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public sealed class RatingRepository : IRatingRepository
{
    private readonly ApplicationDbContext _context;

    public RatingRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Rating?> GetByHallAndUserAsync(
        Guid hallId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        return await _context.Ratings
            .AsNoTracking()
            .FirstOrDefaultAsync(
                r => r.HallId == hallId && r.UserId == userId,
                cancellationToken);
    }

    public async Task AddAsync(Rating rating, CancellationToken cancellationToken = default)
    {
        await _context.Ratings.AddAsync(rating, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(Rating rating, CancellationToken cancellationToken = default)
    {
        _context.Ratings.Update(rating);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<double> GetAverageRatingAsync(Guid hallId, CancellationToken cancellationToken = default)
    {
        var ratings = await _context.Ratings
            .AsNoTracking()
            .Where(r => r.HallId == hallId)
            .Select(r => r.Value)
            .ToListAsync(cancellationToken);

        return ratings.Count == 0 ? 0 : ratings.Average();
    }

    public async Task<int> GetTotalRatingsAsync(Guid hallId, CancellationToken cancellationToken = default)
    {
        return await _context.Ratings
            .AsNoTracking()
            .CountAsync(r => r.HallId == hallId, cancellationToken);
    }

    public async Task<int> GetUserRatingCountAsync(string userId, CancellationToken cancellationToken = default)
    {
        return await _context.Ratings
            .AsNoTracking()
            .CountAsync(r => r.UserId == userId, cancellationToken);
    }
}
