using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>
/// Temporary stub for IRecommendationService. Will be replaced by Abdulaziz's
/// implementation once the criteria extraction and hall matching pipeline is ready.
/// Returns AiUnavailable to signal the downstream service is not yet connected.
/// </summary>
public sealed class RecommendationServiceStub : IRecommendationService
{
    public Task<RecommendationResponse> GetRecommendationsAsync(
        string message,
        string? language,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult(new RecommendationResponse(
            RecommendationStatus.AiUnavailable,
            null,
            Array.Empty<HallRecommendationDto>(),
            "The recommendation service is not yet available. Please try again later.",
            DateTime.UtcNow));
    }
}
