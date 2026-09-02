using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IRatingRepository
{
    Task<Rating?> GetByHallAndUserAsync(Guid hallId, string userId, CancellationToken cancellationToken = default);

    Task AddAsync(Rating rating, CancellationToken cancellationToken = default);

    Task UpdateAsync(Rating rating, CancellationToken cancellationToken = default);

    Task<(double AverageRating, int TotalRatings, int? UserRating)> GetSummaryAsync(
        Guid hallId,
        string? currentUserId,
        CancellationToken cancellationToken = default);

    Task<double> GetAverageRatingAsync(Guid hallId, CancellationToken cancellationToken = default);

    Task<int> GetTotalRatingsAsync(Guid hallId, CancellationToken cancellationToken = default);

    Task<int> GetUserRatingCountAsync(string userId, CancellationToken cancellationToken = default);
}
