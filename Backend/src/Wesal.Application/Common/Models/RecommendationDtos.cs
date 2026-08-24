using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

public sealed record RecommendationRequest(string? Message);

/// <summary>
/// Language precedence for AI responses (bilingual contract):
/// 1. Detected user query language — when reliably determinable.
/// 2. Site/display language — only as fallback when query language is uncertain.
/// 3. Default ("ar") — if neither can determine the language.
/// <see cref="ResponseLanguage"/> declares which language was actually used.
/// </summary>
public sealed record RecommendationResponse(
    RecommendationStatus Status,
    ExtractedCriteriaDto? ExtractedCriteria,
    IReadOnlyList<HallRecommendationDto> Recommendations,
    string Message,
    string ResponseLanguage,
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
