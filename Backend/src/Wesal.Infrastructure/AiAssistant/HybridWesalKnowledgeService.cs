using System.Diagnostics;
using Microsoft.Extensions.Logging;
using Wesal.Application.Ai;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;

namespace Wesal.Infrastructure.AiAssistant;

/// <summary>Combines verified Markdown articles with the live Admin knowledge store.</summary>
public sealed class HybridWesalKnowledgeService : IWesalKnowledgeService
{
    private static readonly (string Trigger, string[] Terms)[] QueryConcepts =
    [
        ("غيرت رايي", ["الغاء", "الغاء الطلب", "العربون مؤكد", "cancel request"]),
        ("غير رايي", ["الغاء", "الغاء الطلب", "العربون مؤكد", "cancel request"]),
        ("change my mind", ["cancel request", "deposit confirmed"]),
        ("بحجز", ["registered user", "submit booking", "hourly slots"]),
        ("احجز", ["registered user", "submit booking", "hourly slots"]),
        ("الحجز", ["registered user", "submit booking", "hourly slots"]),
        ("طلب حجز", ["registered user", "submit booking", "hourly slots"]),
        ("book a hall", ["registered user", "submit booking", "hourly slots"]),
        ("reserve a venue", ["registered user", "submit booking", "hourly slots"]),
        ("own a venue", ["hall owner", "owner dashboard", "add a hall", "identity document"]),
        ("list it", ["hall owner", "owner dashboard", "add a hall", "identity document"]),
        ("صاحب صالة", ["hall owner", "owner dashboard", "add a hall"]),
        ("مصورين", ["المصورين", "photographers"])
    ];

    private static readonly HashSet<string> StopWords = new(StringComparer.Ordinal)
    {
        "what", "is", "the", "a", "an", "who", "how", "does", "do", "can", "of", "for", "in", "on", "to", "me",
        "مين", "شو", "ما", "هي", "هو", "كيف", "هل", "عن", "في", "من", "على", "بدي", "لو", "سمحت"
    };

    private readonly IEmbeddedWesalKnowledgeSource _embedded;
    private readonly IAiKnowledgeStudioRepository _repository;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<HybridWesalKnowledgeService> _logger;

    public HybridWesalKnowledgeService(
        IEmbeddedWesalKnowledgeSource embedded,
        IAiKnowledgeStudioRepository repository,
        TimeProvider timeProvider,
        ILogger<HybridWesalKnowledgeService> logger)
    {
        _embedded = embedded;
        _repository = repository;
        _timeProvider = timeProvider;
        _logger = logger;
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

        var retrievalTimer = Stopwatch.StartNew();
        var lexicalTimer = Stopwatch.StartNew();
        var tokens = AiText.Tokens(normalizedQuestion)
            .Where(token => !StopWords.Contains(token))
            .Distinct(StringComparer.Ordinal)
            .ToArray();
        var conceptTerms = QueryConcepts
            .Where(concept => normalizedQuestion.Contains(concept.Trigger, StringComparison.Ordinal))
            .SelectMany(concept => concept.Terms)
            .Distinct(StringComparer.Ordinal)
            .ToArray();
        var candidateTokens = tokens.Concat(conceptTerms).Distinct(StringComparer.Ordinal).ToArray();
        var today = DateOnly.FromDateTime(_timeProvider.GetUtcNow().UtcDateTime);
        IReadOnlyList<AiKnowledgeArticle> candidates = [];
        try
        {
            candidates = await _repository.SearchPublishedCandidatesAsync(candidateTokens, today, 100, cancellationToken);
        }
        catch (Exception ex)
        {
            // A temporary Dynamic-layer problem must never make built-in
            // knowledge disappear: serve built-ins only and keep going.
            _logger.LogWarning(
                "Dynamic knowledge unavailable; serving built-in knowledge only. exceptionType={ExceptionType}",
                ex.GetType().Name);
        }
        var dynamicMatches = candidates
            .Where(article => IsSourceFamilyEligible(article.Category, normalizedQuestion))
            .Select(article => (Article: article, Score: Score(article, normalizedQuestion, tokens, conceptTerms, language)))
            .Where(match => match.Score > 0)
            .ToList();

        var activeVerifiedOverrides = dynamicMatches
            .Where(match => match.Article.VerificationStatus == AiKnowledgeVerificationStatus.Verified)
            .Select(match => match.Article.OverridesBuiltInKey)
            .Where(key => !string.IsNullOrWhiteSpace(key))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var embeddedArticles = _embedded.GetArticles();
        lexicalTimer.Stop();

        var ranked = new List<RankedArticle>();
        foreach (var match in dynamicMatches)
        {
            var article = match.Article;
            var answer = IsEnglish(language)
                ? article.AnswerEn ?? article.AnswerAr
                : article.AnswerAr;
            var result = new WesalKnowledgeArticle(
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
                match.Score,
                RetrievalMethod(article, normalizedQuestion));
            ranked.Add(new RankedArticle(result, match.Score,
                article.VerificationStatus == AiKnowledgeVerificationStatus.Verified,
                IsExactAlias(article.Aliases, normalizedQuestion, language),
                AliasLanguageMatch(article.Aliases, normalizedQuestion, language),
                article.Priority,
                article.OverridesBuiltInKey is not null));
        }

        foreach (var metadata in embeddedArticles)
        {
            if (metadata.Status == WesalKnowledgeStatus.Draft
                || !IsSourceFamilyEligible(metadata.Category, normalizedQuestion)
                || activeVerifiedOverrides.Contains(metadata.Key))
                continue;

            var exactAlias = metadata.Aliases.Any(alias => AiText.Normalize(alias) == normalizedQuestion);
            var score = exactAlias ? 10_000 : BuiltInScore(metadata, normalizedQuestion, tokens, conceptTerms);
            if (score <= 0)
                continue;

            var content = IsEnglish(language) ? metadata.AnswerEn : metadata.AnswerAr;
            var article = new WesalKnowledgeArticle(metadata.Title, metadata.Category, metadata.Source,
                metadata.LastUpdated, metadata.Status, content, metadata.Key, false, null,
                metadata.Aliases.Where(alias => AiText.Normalize(alias) == normalizedQuestion).Take(5).ToArray(), score,
                exactAlias ? "exact-alias" : score >= 7_000 ? "title" : "lexical");
            ranked.Add(new RankedArticle(article with
            {
                MatchScore = score,
                RetrievalMethod = exactAlias ? "exact-alias" : score >= 7_000 ? "title" : "lexical"
            }, score, metadata.Status == WesalKnowledgeStatus.Verified, exactAlias,
                metadata.Aliases.Count == 0 ? 0 : 1, 0, false));
        }

        var rerankingTimer = Stopwatch.StartNew();
        var exactTrustedAliases = ranked
            .Where(item => item.Verified && item.ExactAlias)
            .ToList();
        var resultPool = exactTrustedAliases.Count > 0 ? exactTrustedAliases : ranked;
        var results = resultPool
            .OrderByDescending(item => item.Verified)
            .ThenByDescending(item => item.ExactAlias)
            .ThenByDescending(item => item.Score)
            .ThenByDescending(item => item.LanguageMatch)
            .ThenByDescending(item => item.IsOverride)
            .ThenByDescending(item => item.Priority)
            .ThenByDescending(item => item.Article.LastUpdated)
            .Select(item => item.Article)
            .Take(Math.Clamp(maxResults, 1, 10))
            .ToList();
        rerankingTimer.Stop();

        retrievalTimer.Stop();
        _logger.LogInformation(
            "Knowledge retrieval: candidateCount={CandidateCount} lexicalMs={LexicalMs} semanticMs={SemanticMs} rerankingMs={RerankingMs} totalMs={TotalMs} method={Method}",
            ranked.Count,
            lexicalTimer.ElapsedMilliseconds,
            0,
            rerankingTimer.ElapsedMilliseconds,
            retrievalTimer.ElapsedMilliseconds,
            results.FirstOrDefault()?.RetrievalMethod ?? "none");
        return results;
    }

    private static int Score(AiKnowledgeArticle article, string normalizedQuestion, IReadOnlyList<string> tokens,
        IReadOnlyList<string> conceptTerms, string? language)
    {
        if (IsExactAlias(article.Aliases, normalizedQuestion, language)) return 10_000;
        if (article.Aliases.Any(alias => AliasLanguageMatches(alias.Language, language)
                && alias.NormalizedText.Length >= normalizedQuestion.Length + 3
                && alias.NormalizedText.Contains($" {normalizedQuestion} ", StringComparison.Ordinal))) return 8_000;

        var normalizedTitle = AiText.Normalize(article.Title);
        if (normalizedTitle == normalizedQuestion) return 7_000;
        if ($" {normalizedTitle} ".Contains($" {normalizedQuestion} ", StringComparison.Ordinal)) return 6_000;

        if (tokens.Count == 0) return 0;
        var searchTokens = AiText.Tokens(article.NormalizedSearchText).ToHashSet(StringComparer.Ordinal);
        var matched = tokens.Count(searchTokens.Contains);
        var coverage = (double)matched / tokens.Count;
        var conceptMatches = conceptTerms.Count(term => AiText.Tokens(AiText.Normalize(term)).All(searchTokens.Contains));
        if (conceptMatches > 0) return 1_500 + conceptMatches * 100 + Math.Clamp(article.Priority, -100, 100);
        if ((tokens.Count == 1 && coverage < 1) || (tokens.Count > 1 && coverage < 0.5)) return 0;
        var languageMatch = article.Aliases.Any(alias => AliasLanguageMatches(alias.Language, language)
            && tokens.All(token => AiText.Tokens(alias.NormalizedText).Contains(token, StringComparer.Ordinal))) ? 50 : 0;
        return 500 + matched * 250 + languageMatch + Math.Clamp(article.Priority, -100, 100);
    }

    private static int BuiltInScore(EmbeddedWesalKnowledgeArticle metadata,
        string normalizedQuestion, IReadOnlyList<string> tokens, IReadOnlyList<string> conceptTerms)
    {
        var title = AiText.Normalize(metadata.Title);
        if (title == normalizedQuestion) return 7_000;
        if ($" {title} ".Contains($" {normalizedQuestion} ", StringComparison.Ordinal)) return 6_000;
        var searchable = new[] { metadata.Title, metadata.Category, metadata.Source, metadata.AnswerAr, metadata.AnswerEn }
            .Concat(metadata.Aliases)
            .SelectMany(value => AiText.Tokens(AiText.Normalize(value)))
            .Where(token => !StopWords.Contains(token))
            .SelectMany(TokenForms)
            .ToHashSet(StringComparer.Ordinal);
        var conceptMatches = conceptTerms.Count(term => AiText.Tokens(AiText.Normalize(term))
            .Where(token => !StopWords.Contains(token)).All(searchable.Contains));
        if (conceptMatches > 0) return 1_500 + conceptMatches * 100;
        var overlap = tokens.Count(token => TokenForms(token).Any(searchable.Contains));
        var coverage = tokens.Count == 0 ? 0 : (double)overlap / tokens.Count;
        return overlap == 0 || (tokens.Count > 1 && coverage < 0.5) ? 0 : 500 + overlap * 250;
    }

    private static IEnumerable<string> TokenForms(string token)
    {
        var normalized = AiText.Normalize(token);
        if (normalized.Length == 0) yield break;
        yield return normalized;
        foreach (var prefix in new[] { "وال", "بال", "كال", "فال", "لل", "ال", "ع", "ب", "ل", "و", "ف" })
        {
            if (normalized.StartsWith(prefix, StringComparison.Ordinal) && normalized.Length - prefix.Length >= 3)
                yield return normalized[prefix.Length..];
        }
    }

    private static bool IsExactAlias(IEnumerable<AiKnowledgeAlias> aliases, string query, string? language)
        => aliases.Any(alias => AliasLanguageMatches(alias.Language, language) && alias.NormalizedText == query);

    private static int AliasLanguageMatch(IEnumerable<AiKnowledgeAlias> aliases, string query, string? language)
        => aliases.Any(alias => AliasLanguageMatches(alias.Language, language) && alias.NormalizedText == query) ? 2
            : aliases.Any(alias => AliasLanguageMatches(alias.Language, language)) ? 1 : 0;

    private static bool AliasLanguageMatches(string aliasLanguage, string? language)
        => string.IsNullOrWhiteSpace(language)
            || language.StartsWith(aliasLanguage, StringComparison.OrdinalIgnoreCase)
            || aliasLanguage.StartsWith(language, StringComparison.OrdinalIgnoreCase);

    private static bool IsSourceFamilyEligible(string category, string query)
    {
        var mentionsMabrouk = query.Contains("mabrouk", StringComparison.Ordinal)
            || query.Contains("mabrook", StringComparison.Ordinal)
            || query.Contains("مبروك", StringComparison.Ordinal);
        var mentionsWesal = query.Contains("wesal", StringComparison.Ordinal)
            || query.Contains("وصال", StringComparison.Ordinal);
        return !(category.Equals("mabrouk", StringComparison.OrdinalIgnoreCase) && !mentionsMabrouk)
            && !(category.Equals("platform", StringComparison.OrdinalIgnoreCase) && mentionsMabrouk && !mentionsWesal);
    }

    private static string RetrievalMethod(AiKnowledgeArticle article, string query)
        => IsExactAlias(article.Aliases, query, null) ? "exact-alias"
            : AiText.Normalize(article.Title) == query ? "title" : "lexical";

    private sealed record RankedArticle(WesalKnowledgeArticle Article, int Score, bool Verified, bool ExactAlias,
        int LanguageMatch, int Priority, bool IsOverride);

    private static bool IsEnglish(string? language)
        => language?.StartsWith("en", StringComparison.OrdinalIgnoreCase) == true;

}
