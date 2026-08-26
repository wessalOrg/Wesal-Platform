using Wesal.Application.Ai;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.AiAssistant;

public sealed class RecommendationService : IRecommendationService
{
    private const string DefaultLanguage = "ar";

    private readonly IRecommendationCriteriaExtractor _criteriaExtractor;
    private readonly IHallRecommendationMatcher _hallMatcher;
    private readonly IAiLanguageDetector _languageDetector;

    public RecommendationService(
        IRecommendationCriteriaExtractor criteriaExtractor,
        IHallRecommendationMatcher hallMatcher,
        IAiLanguageDetector? languageDetector = null)
    {
        _criteriaExtractor = criteriaExtractor;
        _hallMatcher = hallMatcher;
        _languageDetector = languageDetector ?? new AiLanguageDetector();
    }

    public async Task<RecommendationResponse> GetRecommendationsAsync(
        string message,
        string? language,
        CancellationToken cancellationToken = default)
    {
        var detected = _languageDetector.Detect(message);
        var effectiveLanguage = detected ?? (string.IsNullOrWhiteSpace(language) ? DefaultLanguage : language);

        var criteria = _criteriaExtractor.Extract(message);

        // Incomplete criteria — tell the user what we need
        if (string.IsNullOrWhiteSpace(criteria.Region)
            && string.IsNullOrWhiteSpace(criteria.Area)
            && !criteria.Capacity.HasValue
            && !criteria.Date.HasValue)
        {
            var hint = effectiveLanguage == "en"
                ? "I need a bit more detail to find the perfect hall. Could you tell me the region (e.g., Gaza, North Gaza), number of guests, or a preferred date?"
                : "أحتاج قليلاً من التفاصيل لإيجاد القاعة المناسبة. هل يمكنك إخباري بالمنطقة (مثلاً غزة، شمال غزة)، عدد الضيوف، أو التاريخ المفضل؟";
            return new RecommendationResponse(
                RecommendationStatus.IncompleteCriteria,
                criteria,
                Array.Empty<HallRecommendationDto>(),
                hint,
                effectiveLanguage,
                DateTime.UtcNow);
        }

        var matches = await _hallMatcher.FindMatchingHallsAsync(criteria, cancellationToken);

        if (matches.Count == 0)
        {
            var noResults = effectiveLanguage == "en"
                ? "I searched but couldn't find a hall matching your criteria right now. Try adjusting the region, date, or capacity."
                : "بحثت لكن لم أجد قاعة تطابق معاييرك حاليًا. جرّب تغيير المنطقة أو التاريخ أو السعة.";
            return new RecommendationResponse(
                RecommendationStatus.NoResults,
                criteria,
                Array.Empty<HallRecommendationDto>(),
                noResults,
                effectiveLanguage,
                DateTime.UtcNow);
        }

        var successMessage = effectiveLanguage == "en"
            ? $"I found {matches.Count} hall(s) matching your criteria."
            : $"وجدت {matches.Count} قاعة(قاعات) تطابق معاييرك.";

        return new RecommendationResponse(
            RecommendationStatus.Success,
            criteria,
            matches,
            successMessage,
            effectiveLanguage,
            DateTime.UtcNow);
    }
}
