using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

public sealed record RecommendationRequest(string? Message);

public sealed record RecommendationResponse(
    RecommendationStatus Status,
    ExtractedCriteriaDto? ExtractedCriteria,
    IReadOnlyList<HallRecommendationDto> Recommendations,
    string Message,
    DateTime Timestamp);

public sealed record ExtractedCriteriaDto(
    string? Region,
    string? Area,
    DateOnly? Date,
    string? BookingPeriod,
    int? Capacity);

public sealed record HallRecommendationDto(
    Guid HallId,
    string HallName,
    string Region,
    string Address,
    int Capacity,
    decimal? Price,
    string? MainImage,
    bool IsAvailable,
    string? UnavailableReason);

public enum RecommendationStatus
{
    Success,
    IncompleteCriteria,
    NoResults,
    AiUnavailable
}
