using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IHallRecommendationMatcher
{
    Task<IReadOnlyList<HallRecommendationDto>> FindMatchingHallsAsync(
        ExtractedCriteriaDto criteria,
        CancellationToken cancellationToken = default);
}
