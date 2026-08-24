using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IRecommendationService
{
    /// <summary>
    /// Processes a natural-language hall recommendation request. The implementation
    /// is responsible for: extracting structured search criteria from the message,
    /// validating dates and booking periods, matching halls, verifying real-time
    /// availability, and returning results.
    /// </summary>
    Task<RecommendationResponse> GetRecommendationsAsync(
        string message,
        string? language,
        CancellationToken cancellationToken = default);
}
