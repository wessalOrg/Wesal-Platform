using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IHowToService
{
    /// <summary>
    /// Processes a how-to/usage question about the platform.
    ///
    /// Language precedence (bilingual contract):
    /// 1. <paramref name="language"/> — site display language carried from the AI session.
    ///    This serves as fallback context when the user's query language is uncertain.
    /// 2. The implementation SHOULD prioritize the detected user query language when
    ///    reliably determinable. The <see cref="HowToResponse.ResponseLanguage"/> must
    ///    declare which language was actually used for the response.
    /// 3. If language cannot be determined, default to "ar".
    /// </summary>
    Task<HowToResponse> AskHowToAsync(string question, string? language, CancellationToken cancellationToken = default);
}
