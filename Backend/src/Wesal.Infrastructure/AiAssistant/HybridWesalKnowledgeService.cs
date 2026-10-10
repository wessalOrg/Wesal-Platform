using Wesal.Application.Ai;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>Combines verified Markdown articles with the live Admin knowledge store.</summary>
public sealed class HybridWesalKnowledgeService : IWesalKnowledgeService
{
    private static readonly HashSet<string> StopWords = new(StringComparer.Ordinal)
    {
        "what", "is", "the", "a", "an", "who", "how", "does", "do", "can", "of", "for", "in", "on", "to", "me",
        "مين", "شو", "ما", "هي", "هو", "كيف", "هل", "عن", "في", "من", "على", "بدي", "لو", "سمحت"
    };

    private readonly IEmbeddedWesalKnowledgeSource _embedded;
    private readonly IAiKnowledgeStudioRepository _repository;
    private readonly TimeProvider _timeProvider;

    public HybridWesalKnowledgeService(
        IEmbeddedWesalKnowledgeSource embedded,
        IAiKnowledgeStudioRepository repository,
        TimeProvider timeProvider)
    {
        _embedded = embedded;
        _repository = repository;
        _timeProvider = timeProvider;
    }

    public async Task<IReadOnlyList<WesalKnowledgeArticle>> SearchAsync(
        string question,
        string? language,
        int maxResults = 3,
        CancellationToken cancellationToken = default)
    {
        var normalizedQuestion = AiText.Normalize(question);
        if (normalizedQuestion.Length == 0)
        {
            return [];
        }

        var tokens = AiText.Tokens(normalizedQuestion)
            .Where(token => !StopWords.Contains(token))
            .Distinct(StringComparer.Ordinal)
            .ToArray();
        var today = DateOnly.FromDateTime(_timeProvider.GetUtcNow().UtcDateTime);
        var candidates = await _repository.SearchPublishedCandidatesAsync(tokens, today, 100, cancellationToken);
        var dynamicMatches = candidates
            .Select(article => (Article: article, Score: Score(article, normalizedQuestion, tokens)))
            .Where(match => match.Score > 0)
            .OrderByDescending(match => match.Article.VerificationStatus == AiKnowledgeVerificationStatus.Verified)
            .ThenByDescending(match => match.Score)
            .ThenByDescending(match => match.Article.Priority)
            .ThenByDescending(match => match.Article.UpdatedAt)
            .ToList();

        var activeVerifiedOverrides = dynamicMatches
            .Where(match => match.Article.VerificationStatus == AiKnowledgeVerificationStatus.Verified)
            .Select(match => match.Article.OverridesBuiltInKey)
            .Where(key => !string.IsNullOrWhiteSpace(key))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var builtInMatches = await _embedded.SearchAsync(question, language, Math.Clamp(maxResults * 3, 3, 10), cancellationToken);
        var embeddedArticles = _embedded.GetArticles();
        var builtInByMetadata = embeddedArticles.ToDictionary(
            article => MetadataKey(article.Title, article.Category, article.Source),
            article => article);
        var eligibleBuiltIns = builtInMatches
            .Where(article => article.Status != WesalKnowledgeStatus.Draft)
            .Where(article =>
            {
                var key = MetadataKey(article.Title, article.Category, article.Source);
                return !builtInByMetadata.TryGetValue(key, out var builtIn)
                    || !activeVerifiedOverrides.Contains(builtIn.Key);
            });

        var dynamicArticles = dynamicMatches.Select(match =>
        {
            var article = match.Article;
            var answer = IsEnglish(language)
                ? article.AnswerEn ?? article.AnswerAr
                : article.AnswerAr;
            return new WesalKnowledgeArticle(
                article.Title,
                article.Category,
                article.Source,
                article.UpdatedAt == default
                    ? today
                    : DateOnly.FromDateTime(article.UpdatedAt.UtcDateTime),
                article.VerificationStatus == AiKnowledgeVerificationStatus.Verified
                    ? WesalKnowledgeStatus.Verified
                    : WesalKnowledgeStatus.NeedsVerification,
                answer,
                article.Key,
                true,
                article.PublishedVersion,
                article.Aliases
                    .Where(alias => alias.NormalizedText.Length > 0
                        && (normalizedQuestion == alias.NormalizedText
                            || tokens.Any(token => alias.NormalizedText.Contains(token, StringComparison.Ordinal))))
                    .Select(alias => alias.Text)
                    .Distinct(StringComparer.Ordinal)
                    .Take(5)
                    .ToList(),
                match.Score);
        });

        return dynamicArticles
            .Concat(eligibleBuiltIns)
            .Take(Math.Clamp(maxResults, 1, 10))
            .ToList();
    }

    private static int Score(AiKnowledgeArticle article, string normalizedQuestion, IReadOnlyList<string> tokens)
    {
        var aliases = article.Aliases.Select(alias => alias.NormalizedText).ToArray();
        if (aliases.Any(alias => alias == normalizedQuestion)) return 10_000;
        if (aliases.Any(alias => alias.Contains(normalizedQuestion, StringComparison.Ordinal))) return 8_000;

        var normalizedTitle = AiText.Normalize(article.Title);
        if (normalizedTitle == normalizedQuestion) return 7_000;
        if (normalizedTitle.Contains(normalizedQuestion, StringComparison.Ordinal)) return 6_000;

        if (tokens.Count == 0) return 0;
        var searchText = article.NormalizedSearchText;
        var matched = tokens.Count(token => searchText.Contains(token, StringComparison.Ordinal));
        var coverage = (double)matched / tokens.Count;
        if ((tokens.Count == 1 && coverage < 1) || (tokens.Count > 1 && coverage < 0.5)) return 0;
        return 500 + matched * 250 + article.Priority;
    }

    private static bool IsEnglish(string? language)
        => language?.StartsWith("en", StringComparison.OrdinalIgnoreCase) == true;

    private static string MetadataKey(string title, string category, string source)
        => $"{title}\u001f{category}\u001f{source}";
}
