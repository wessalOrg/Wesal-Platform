using System.Text.Json;
using Wesal.Application.Ai;
using Wesal.Application.Ai.Navigation;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;

namespace Wesal.Infrastructure.AiAssistant;

public sealed partial class MabroukKnowledgeStudioService
{
    public async Task<AiKnowledgeSimulatorResult> SimulateAsync(
        AiKnowledgeSimulatorRequest request,
        CancellationToken cancellationToken = default)
    {
        var question = AiKnowledgeGapSanitizer.Sanitize(request.Question, 1000);
        if (question.Length < 2)
            throw new AiKnowledgeStudioException("InvalidSimulatorQuestion", "Enter a question to preview.");
        var language = request.Language?.StartsWith("en", StringComparison.OrdinalIgnoreCase) == true
            ? "en"
            : request.Language?.StartsWith("ar", StringComparison.OrdinalIgnoreCase) == true
                ? "ar"
                : question.Any(character => character is >= '\u0600' and <= '\u06ff') ? "ar" : "en";

        if (request.FullAssistant)
        {
            if (request.TestDraft)
                throw new AiKnowledgeStudioException("DraftPreviewModeConflict", "Draft preview is available in Knowledge only mode.");
            return await SimulateFullAssistantAsync(question, language, request, cancellationToken);
        }

        if (request.TestDraft)
        {
            if (!request.DraftArticleId.HasValue)
                throw new AiKnowledgeStudioException("DraftArticleRequired", "Choose a draft article to test.");
            var article = await _repository.GetArticleAsync(request.DraftArticleId.Value, cancellationToken);
            if (article is null) throw new AiKnowledgeStudioException("ArticleNotFound", "The knowledge article was not found.", 404);
            var snapshot = ReadDraftSnapshot(article) ?? Capture(article);
            var draftScore = ScoreDraft(snapshot, question);
            if (draftScore == 0)
                return new AiKnowledgeSimulatorResult(
                    language == "en" ? "This draft does not match the question." : "هذه المسودة لا تطابق السؤال.",
                    "Draft preview", snapshot.Key, snapshot.Title, article.PublicationStatus.ToString(),
                    snapshot.VerificationStatus.ToString(), [], 0, false, 0, true);
            var answer = language == "en" ? snapshot.AnswerEn ?? snapshot.AnswerAr : snapshot.AnswerAr;
            return new AiKnowledgeSimulatorResult(answer, "Draft preview", snapshot.Key, snapshot.Title,
                "Draft", snapshot.VerificationStatus.ToString(), MatchedDraftAliases(snapshot, question),
                draftScore, false, 0, true);
        }

        var results = await _knowledge.SearchAsync(question, language, 1, cancellationToken);
        var match = results.FirstOrDefault();
        if (match is null)
        {
            return new AiKnowledgeSimulatorResult(
                language == "en" ? "I don't have trusted information on this yet." : "ما عندي معلومة موثوقة عن هذا الموضوع حاليًا.",
                "Fallback", null, null, "No match", "Not applicable", [], null, false, 0, false);
        }

        var sourceType = match.IsDynamic ? "Dynamic DB" : "Built-in KB";
        var aliases = match.MatchedAliases ?? [];
        var score = match.MatchScore;
        if (!match.IsDynamic)
        {
            var source = _embedded.GetArticles().FirstOrDefault(article => article.Key == match.StableKey);
            if (source is not null)
                aliases = source.Aliases.Where(alias => AiText.Normalize(alias) == AiText.Normalize(question)).Take(5).ToList();
        }
        var answerText = WesalKnowledgeAnswerComposer.Compose(match, language);
        return new AiKnowledgeSimulatorResult(answerText, sourceType, match.StableKey, match.Title,
            "Published", match.Status.ToString(), aliases, score, false, 0, false);
    }

    private async Task<AiKnowledgeSimulatorResult> SimulateFullAssistantAsync(
        string question,
        string language,
        AiKnowledgeSimulatorRequest request,
        CancellationToken cancellationToken)
    {
        if (request.PagePath?.Length > 300)
            throw new AiKnowledgeStudioException("InvalidSimulatorContext", "Page path must be at most 300 characters.");

        var pagePath = AiKnowledgeGapSanitizer.Sanitize(request.PagePath, 300);
        Guid? hallId = null;
        if (!string.IsNullOrWhiteSpace(request.HallId))
        {
            if (!Guid.TryParse(request.HallId.Trim(), out var parsedHallId) || parsedHallId == Guid.Empty)
                throw new AiKnowledgeStudioException("InvalidSimulatorContext", "Hall ID must be a valid identifier.");
            hallId = parsedHallId;
        }

        var requestContext = new AiRequestContext(
            string.IsNullOrWhiteSpace(pagePath) ? null : new AiPageContextDto(pagePath),
            hallId.HasValue ? new AiEntityContextDto("hall", hallId.Value.ToString("D")) : null);
        var response = await _assistantService.ProcessMessageAsync(
            question, language, cancellationToken, context: null, requestContext: requestContext);

        var knowledgeMatch = (await _knowledge.SearchAsync(question, language, 3, cancellationToken))
            .FirstOrDefault(article => string.Equals(
                response.Message,
                WesalKnowledgeAnswerComposer.Compose(article, language),
                StringComparison.Ordinal));

        string sourceType;
        if (knowledgeMatch is not null)
        {
            sourceType = knowledgeMatch.IsDynamic ? "Dynamic DB" : "Built-in KB";
        }
        else if (response.Kind is AiAssistantResponseKind.Halls
            or AiAssistantResponseKind.HallDetails
            or AiAssistantResponseKind.Availability
            || response.Intent?.Intent is AiIntentType.SearchHalls
                or AiIntentType.GetHallDetails
                or AiIntentType.CheckHallAvailability)
        {
            sourceType = "Live tool";
        }
        else if (response.Kind == AiAssistantResponseKind.Unsupported
            || response.Intent?.Intent == AiIntentType.Unsupported
            || AiNavigationIntentDetector.DetectUnavailableTopic(question) is { } unavailable
                && WesalCapabilityRegistry.Find(unavailable.Key) is not null)
        {
            sourceType = "Capability";
        }
        else if (response.Kind == AiAssistantResponseKind.Error)
        {
            sourceType = "Fallback";
        }
        else
        {
            // The assistant response contract does not expose a more precise route source.
            sourceType = "Full assistant";
        }

        return new AiKnowledgeSimulatorResult(
            response.Message,
            sourceType,
            knowledgeMatch?.StableKey,
            knowledgeMatch?.Title,
            knowledgeMatch is null ? "Not applicable" : "Published",
            knowledgeMatch?.Status.ToString() ?? "Not applicable",
            knowledgeMatch?.MatchedAliases ?? [],
            knowledgeMatch?.MatchScore,
            null,
            null,
            false,
            response.Kind.ToString());
    }

    public async Task<AiKnowledgeAnalyticsDto> GetAnalyticsAsync(CancellationToken cancellationToken = default)
    {
        var today = Today;
        var articles = await _repository.ListArticlesAsync(cancellationToken);
        var gaps = await _repository.ListGapsAsync(true, 1000, cancellationToken);
        var unresolved = gaps.OrderByDescending(gap => gap.OccurrenceCount)
            .ThenByDescending(gap => gap.LastSeenAt).ToList();
        return new AiKnowledgeAnalyticsDto(
            articles.Count(article => article.PublicationStatus == AiKnowledgePublicationStatus.Published && IsActive(article, today)),
            articles.Count(article => article.PublicationStatus == AiKnowledgePublicationStatus.Draft || article.DraftSnapshotJson is not null),
            _embedded.GetArticles().Count,
            articles.Count(article => article.PublicationStatus == AiKnowledgePublicationStatus.Published
                && (article.VerificationStatus == AiKnowledgeVerificationStatus.NeedsVerification
                    || article.ReviewAt.HasValue && article.ReviewAt.Value <= today)),
            articles.Count(article => article.EffectiveUntil.HasValue && article.EffectiveUntil.Value < today),
            articles.Count(article => article.PublicationStatus == AiKnowledgePublicationStatus.Published
                && article.EffectiveUntil.HasValue && article.EffectiveUntil.Value >= today
                && article.EffectiveUntil.Value <= today.AddDays(30)),
            await GetUnresolvedGapCountAsync(cancellationToken),
            await _repository.CountUnresolvedOccurrencesAsync(cancellationToken),
            await _repository.CountGapsAsync(AiKnowledgeGapStatus.Resolved, cancellationToken),
            unresolved.Take(8).Select(gap => ToDto(gap)).ToList(),
            articles.OrderByDescending(article => article.UpdatedAt).Take(8).Select(article => ToDto(article)).ToList());
    }

    public async Task<AiKnowledgeExportDto> ExportAsync(CancellationToken cancellationToken = default)
    {
        var articles = await _repository.ListArticlesAsync(cancellationToken);
        var export = articles.Select(article =>
        {
            var snapshot = ReadDraftSnapshot(article) ?? Capture(article);
            return new AiKnowledgeExportArticle(
                snapshot.Key, snapshot.Title, snapshot.Category, snapshot.AnswerAr, snapshot.AnswerEn,
                snapshot.Source, snapshot.Priority, article.PublicationStatus.ToString(),
                snapshot.VerificationStatus.ToString(), snapshot.EffectiveFrom, snapshot.EffectiveUntil,
                snapshot.ReviewAt, snapshot.OverridesBuiltInKey,
                snapshot.Aliases.Select(alias => new AiKnowledgeAliasDto(Guid.Empty, alias.Language, alias.Text)).ToList());
        }).ToList();
        return new AiKnowledgeExportDto("1", _timeProvider.GetUtcNow(), export);
    }

    private static int ScoreDraft(AiKnowledgeSnapshot snapshot, string question)
    {
        var normalized = AiText.Normalize(question);
        if (snapshot.Aliases.Any(alias => AiText.Normalize(alias.Text) == normalized)) return 10000;
        if (AiText.Normalize(snapshot.Title).Contains(normalized, StringComparison.Ordinal)) return 7000;
        var tokens = AiText.Tokens(normalized);
        var searchText = AiText.Normalize(string.Join(' ', snapshot.Key, snapshot.Title, snapshot.Category,
            snapshot.AnswerAr, snapshot.AnswerEn, string.Join(' ', snapshot.Aliases.Select(alias => alias.Text))));
        var matched = tokens.Count(token => searchText.Contains(token, StringComparison.Ordinal));
        return tokens.Count > 0 && matched * 2 >= tokens.Count ? 500 + matched * 250 : 0;
    }

    private static IReadOnlyList<string> MatchedDraftAliases(AiKnowledgeSnapshot snapshot, string question)
    {
        var normalized = AiText.Normalize(question);
        return snapshot.Aliases.Where(alias => AiText.Normalize(alias.Text) == normalized)
            .Select(alias => alias.Text).Take(5).ToList();
    }
}
