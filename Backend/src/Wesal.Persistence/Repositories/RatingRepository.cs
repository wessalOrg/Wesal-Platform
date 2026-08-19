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

    public Task<Rating?> GetByHallAndUserAsync(
        Guid hallId,
        string userId,
        CancellationToken cancellationToken = default)
        => _context.Ratings.FirstOrDefaultAsync(
            rating => rating.HallId == hallId && rating.UserId == userId,
            cancellationToken);

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
        var hasRatings = await _context.Ratings
            .AsNoTracking()
            .AnyAsync(rating => rating.HallId == hallId, cancellationToken);

        if (!hasRatings)
        {
            return 0;
        }

        return await _context.Ratings
            .AsNoTracking()
            .Where(rating => rating.HallId == hallId)
            .AverageAsync(rating => rating.Value, cancellationToken);
    }

    public Task<int> GetTotalRatingsAsync(Guid hallId, CancellationToken cancellationToken = default)
        => _context.Ratings
            .AsNoTracking()
            .CountAsync(rating => rating.HallId == hallId, cancellationToken);
}
