using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IRatingService
{
    Task<RatingResponse> CreateRatingAsync(CreateRatingRequest request, CancellationToken cancellationToken = default);

    Task<RatingResponse> UpdateRatingAsync(UpdateRatingRequest request, CancellationToken cancellationToken = default);

    Task<HallRatingSummary> GetHallRatingSummaryAsync(Guid hallId, CancellationToken cancellationToken = default);
}
