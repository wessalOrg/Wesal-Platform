using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IRecommendationService
{
    /// <summary>
    /// Processes a natural-language hall recommendation request. The implementation
    /// is responsible for: extracting structured search criteria from the message,
    /// validating dates and booking periods, matching halls, verifying real-time
    /// availability, and returning results.
    ///
    /// Language precedence (bilingual contract):
    /// 1. Detected user query language — when reliably determinable from <paramref name="message"/>.
    /// 2. <paramref name="language"/> — site display language from the AI session, used as fallback.
    /// 3. Default ("ar") — if neither can determine the language.
    /// The <see cref="RecommendationResponse.ResponseLanguage"/> must declare which language
    /// was actually used for the response text.
    /// </summary>
    Task<RecommendationResponse> GetRecommendationsAsync(
        string message,
        string? language,
        CancellationToken cancellationToken = default);
}
