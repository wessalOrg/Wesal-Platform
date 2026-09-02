using System.Text.RegularExpressions;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;

namespace Wesal.Application.Ai;

/// <summary>
/// Deterministic intent classification used when Gemini is unavailable or returns
/// an invalid result. Reuses the existing <see cref="IRecommendationCriteriaExtractor"/>
/// for hall-search criteria so fallback behavior stays consistent with the
/// recommendation pipeline. Never guesses values that were not explicitly stated.
/// </summary>
public sealed partial class AiIntentFallbackClassifier
{
    private readonly IRecommendationCriteriaExtractor _criteriaExtractor;

    public AiIntentFallbackClassifier(IRecommendationCriteriaExtractor criteriaExtractor)
    {
        _criteriaExtractor = criteriaExtractor;
    }

    public AiAssistantIntentDto Classify(string message)
    {
        var text = (message ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(text))
        {
            return new AiAssistantIntentDto(AiIntentType.Unknown, null, null, null, null, null, null);
        }

        var criteria = _criteriaExtractor.Extract(text);
        var hasCriteria = !string.IsNullOrWhiteSpace(criteria.Region)
            || !string.IsNullOrWhiteSpace(criteria.Area)
            || criteria.Date.HasValue
            || criteria.Capacity.HasValue;

        if (hasCriteria)
        {
            BookingPeriodType? period = null;
            if (!string.IsNullOrWhiteSpace(criteria.BookingPeriod)
                && Enum.TryParse<BookingPeriodType>(criteria.BookingPeriod, true, out var parsed))
            {
                period = parsed;
            }

            return new AiAssistantIntentDto(
                AiIntentType.SearchHalls,
                criteria.Region,
                criteria.Area,
                criteria.Date,
                period,
                criteria.Capacity,
                null);
        }

        // Asking "how" (or expressing intent) must stay informational; only a direct
        // imperative command is treated as an unsupported action request.
        if (HowToRegex().IsMatch(text))
        {
            return new AiAssistantIntentDto(AiIntentType.HowTo, null, null, null, null, null, null);
        }

        if (ActionRequestRegex().IsMatch(text))
        {
            return new AiAssistantIntentDto(AiIntentType.Unsupported, null, null, null, null, null, null);
        }

        // Anything else is treated as an informational question the how-to service
        // can answer with guidance or a clarifying prompt.
        return new AiAssistantIntentDto(AiIntentType.HowTo, null, null, null, null, null, null);
    }

    [GeneratedRegex(@"(?:كيف|how\s+(?:do\s+i|can\s+i|to|does|is)|i\s+(?:want|would\s+like)\s+to|أريد\s+أن|اريد\s+ان|أريد|اريد|عايز|ابغى|أبغي|أرغب\s+في)", RegexOptions.IgnoreCase)]
    private static partial Regex HowToRegex();

    [GeneratedRegex(@"(?:^|\s)(?:book|reserve|cancel|pay|subscribe|renew|create\s+an?(?:\s+booking|\s+account)|أحجز|احجز|حجز\s+لي|ألغِ|الغاء|إلغاء|ادفع|أدفع|جدد|جددّ)(?:\s|$)", RegexOptions.IgnoreCase)]
    private static partial Regex ActionRequestRegex();
}