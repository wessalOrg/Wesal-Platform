using System.Text.Json;
using System.Text.RegularExpressions;
using Wesal.Application.Ai;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;

namespace Wesal.Infrastructure.AiAssistant;

public sealed partial class MabroukKnowledgeStudioService : IAiKnowledgeStudioService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly Regex KeyPattern = new("^[a-z0-9]+(?:[-.][a-z0-9]+)*$", RegexOptions.CultureInvariant | RegexOptions.Compiled);
    private static readonly Regex HtmlTagPattern = new("</?[a-z][^>]*>", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);
    private readonly IAiKnowledgeStudioRepository _repository;
    private readonly IEmbeddedWesalKnowledgeSource _embedded;
    private readonly IWesalKnowledgeService _knowledge;
    private readonly IGeminiService _gemini;
    private readonly IAiAssistantService _assistantService;
    private readonly TimeProvider _timeProvider;

    public MabroukKnowledgeStudioService(
        IAiKnowledgeStudioRepository repository,
        IEmbeddedWesalKnowledgeSource embedded,
        IWesalKnowledgeService knowledge,
        IGeminiService gemini,
        IAiAssistantService assistantService,
        TimeProvider timeProvider)
    {
        _repository = repository;
        _embedded = embedded;
        _knowledge = knowledge;
        _gemini = gemini;
        _assistantService = assistantService;
        _timeProvider = timeProvider;
    }

    public async Task<AiKnowledgeStudioOverviewDto> GetOverviewAsync(CancellationToken cancellationToken = default)
    {
        var today = Today;
        var articles = await _repository.ListArticlesAsync(cancellationToken);
        var gaps = await _repository.ListGapsAsync(true, 1000, cancellationToken);
        var newCount = await _repository.CountGapsAsync(AiKnowledgeGapStatus.New, cancellationToken);
        var reviewedCount = await _repository.CountGapsAsync(AiKnowledgeGapStatus.Reviewed, cancellationToken);
        var builtIn = _embedded.GetArticles();
        var recentPublished = articles
            .Where(article => article.PublicationStatus == AiKnowledgePublicationStatus.Published && article.PublishedAt.HasValue)
            .OrderByDescending(article => article.PublishedAt)
            .Take(5)
            .Select(article => ToDto(article))
            .ToList();
        var needsReview = articles
            .Where(article => article.PublicationStatus == AiKnowledgePublicationStatus.Published
                && (article.VerificationStatus == AiKnowledgeVerificationStatus.NeedsVerification
                    || article.ReviewAt.HasValue && article.ReviewAt.Value <= today))
            .OrderBy(article => article.ReviewAt ?? DateOnly.MaxValue)
            .Take(8)
            .Select(article => ToDto(article))
            .ToList();

        return new AiKnowledgeStudioOverviewDto(
            articles.Count(article => IsActive(article, today)),
            articles.Count(article => article.PublicationStatus == AiKnowledgePublicationStatus.Draft || article.DraftSnapshotJson is not null),
            builtIn.Count,
            newCount + reviewedCount,
            await _repository.CountUnresolvedOccurrencesAsync(cancellationToken),
            articles.Count(article => article.PublicationStatus == AiKnowledgePublicationStatus.Published
                && (article.VerificationStatus == AiKnowledgeVerificationStatus.NeedsVerification
                    || article.ReviewAt.HasValue && article.ReviewAt.Value <= today)),
            articles.Count(article => article.EffectiveUntil.HasValue && article.EffectiveUntil.Value < today),
            articles.Count(article => article.PublicationStatus == AiKnowledgePublicationStatus.Published
                && article.EffectiveUntil.HasValue
                && article.EffectiveUntil.Value >= today
                && article.EffectiveUntil.Value <= today.AddDays(30)),
            await _repository.CountGapsAsync(AiKnowledgeGapStatus.Resolved, cancellationToken),
            gaps.OrderByDescending(cluster => cluster.LastSeenAt).Take(5).Select(ToDto).ToList(),
            recentPublished,
            needsReview);
    }

    public async Task<IReadOnlyList<AiKnowledgeArticleDto>> ListKnowledgeAsync(
        AiKnowledgeListQuery query,
        CancellationToken cancellationToken = default)
    {
        var today = Today;
        var dynamicArticles = (await _repository.ListArticlesAsync(cancellationToken)).Select(article => ToDto(article));
        var builtInArticles = _embedded.GetArticles().Select(ToBuiltInDto);
        IEnumerable<AiKnowledgeArticleDto> results = dynamicArticles.Concat(builtInArticles);

        if (!string.IsNullOrWhiteSpace(query.Source))
            results = results.Where(article => string.Equals(article.IsBuiltIn ? "builtin" : "dynamic", query.Source, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(query.PublicationStatus))
            results = results.Where(article => article.PublicationStatus.Equals(query.PublicationStatus, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(query.VerificationStatus))
            results = results.Where(article => article.VerificationStatus.Equals(query.VerificationStatus, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(query.Category))
            results = results.Where(article => article.Category.Equals(query.Category, StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(query.Review))
        {
            results = query.Review.Trim().ToLowerInvariant() switch
            {
                "review-due" => results.Where(article => article.ReviewAt.HasValue && article.ReviewAt.Value <= today),
                "expiring" => results.Where(article => article.EffectiveUntil.HasValue
                    && article.EffectiveUntil.Value >= today && article.EffectiveUntil.Value <= today.AddDays(30)),
                "expired" => results.Where(article => article.EffectiveUntil.HasValue && article.EffectiveUntil.Value < today),
                "current" => results.Where(article => !article.ReviewAt.HasValue || article.ReviewAt.Value > today),
                _ => results
            };
        }
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = AiText.Normalize(query.Search);
            results = results.Where(article => AiText.Normalize(string.Join(' ',
                article.Key, article.Title, article.Category, article.AnswerAr, article.AnswerEn,
                string.Join(' ', article.Aliases.Select(alias => alias.Text)))).Contains(search, StringComparison.Ordinal));
        }
        return results.OrderByDescending(article => article.UpdatedAt).Take(1000).ToList();
    }

    public async Task<AiKnowledgeArticleDto?> GetKnowledgeAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var article = await _repository.GetArticleAsync(id, cancellationToken);
        return article is null ? null : ToDto(article, includeDraft: true);
    }

    public async Task<AiKnowledgeArticleDto> CreateKnowledgeAsync(
        AiKnowledgeArticleInput input, string? userId, CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeAndValidate(input, requireAnswer: false);
        await EnsureUniqueKeyAsync(normalized.Key, null, cancellationToken);
        var now = _timeProvider.GetUtcNow();
        var article = new AiKnowledgeArticle
        {
            Key = normalized.Key, Title = normalized.Title, Category = normalized.Category,
            AnswerAr = normalized.AnswerAr, AnswerEn = normalized.AnswerEn, Source = normalized.Source,
            Priority = normalized.Priority, PublicationStatus = AiKnowledgePublicationStatus.Draft,
            VerificationStatus = normalized.VerificationStatus, EffectiveFrom = normalized.EffectiveFrom,
            EffectiveUntil = normalized.EffectiveUntil, ReviewAt = normalized.ReviewAt,
            OverridesBuiltInKey = normalized.OverridesBuiltInKey, CreatedAt = now, UpdatedAt = now,
            CreatedByUserId = userId, UpdatedByUserId = userId
        };
        ReplaceAliases(article, normalized.Aliases, now);
        article.NormalizedSearchText = BuildSearchText(article);
        article.CurrentVersion = 1;
        _repository.AddArticle(article);
        _repository.AddRevision(CreateRevision(article, "DraftCreated", normalized.ChangeNote, userId, now));
        await _repository.SaveChangesAsync(cancellationToken);
        return ToDto(article);
    }

    public async Task<AiKnowledgeArticleDto?> UpdateKnowledgeAsync(
        Guid id, AiKnowledgeArticleInput input, string? userId, CancellationToken cancellationToken = default)
    {
        var article = await _repository.GetArticleAsync(id, cancellationToken);
        if (article is null) return null;
        if (article.PublicationStatus == AiKnowledgePublicationStatus.Archived)
            throw new AiKnowledgeStudioException("ArticleArchived", "Archived knowledge cannot be edited. Duplicate it as a draft first.", 409);

        var normalized = NormalizeAndValidate(input, requireAnswer: false);
        await EnsureUniqueKeyAsync(normalized.Key, article.Id, cancellationToken);
        var now = _timeProvider.GetUtcNow();
        var snapshot = FromInput(normalized);
        article.UpdatedAt = now;
        article.UpdatedByUserId = userId;
        if (article.PublicationStatus == AiKnowledgePublicationStatus.Published)
        {
            // Keep serving the last published fields until an Admin explicitly publishes this draft.
            article.DraftSnapshotJson = JsonSerializer.Serialize(snapshot, JsonOptions);
        }
        else
        {
            ApplySnapshot(article, snapshot, now);
        }
        article.CurrentVersion++;
        _repository.AddRevision(CreateRevision(article, "DraftSaved", normalized.ChangeNote, userId, now, snapshot));
        await _repository.SaveChangesAsync(cancellationToken);
        return ToDto(article, includeDraft: true);
    }

    public async Task<AiKnowledgeArticleDto?> PublishKnowledgeAsync(
        Guid id, string changeNote, string? userId, CancellationToken cancellationToken = default)
    {
        var article = await _repository.GetArticleAsync(id, cancellationToken);
        if (article is null) return null;
        var snapshot = ReadDraftSnapshot(article) ?? Capture(article);
        var candidate = ToInput(snapshot, changeNote);
        var normalized = NormalizeAndValidate(candidate, requireAnswer: true);
        await EnsureUniqueKeyAsync(normalized.Key, article.Id, cancellationToken);
        var conflicts = await CheckConflictsAsync(candidate, article.Id, cancellationToken);
        if (!conflicts.CanPublish)
            throw new AiKnowledgeStudioException("CapabilityConflict",
                "This article conflicts with current Wesal capability truth and cannot be published.", 409,
                new Dictionary<string, string[]> { ["conflicts"] = conflicts.Conflicts.Select(conflict => conflict.Message).ToArray() });

        var now = _timeProvider.GetUtcNow();
        ApplySnapshot(article, FromInput(normalized), now);
        article.PublicationStatus = AiKnowledgePublicationStatus.Published;
        article.PublishedAt = now;
        article.UpdatedAt = now;
        article.UpdatedByUserId = userId;
        article.DraftSnapshotJson = null;
        article.CurrentVersion++;
        article.PublishedVersion = article.CurrentVersion;
        _repository.AddRevision(CreateRevision(article, "Published", RequireChangeNote(changeNote), userId, now));
        IReadOnlyList<AiKnowledgeGapCluster> linkedGaps = article.VerificationStatus == AiKnowledgeVerificationStatus.Verified && IsActive(article, Today)
            ? await _repository.GetUnresolvedGapsLinkedToArticleAsync(article.Id, cancellationToken)
            : [];
        foreach (var gap in linkedGaps)
        {
            gap.Status = AiKnowledgeGapStatus.Resolved;
            gap.ResolvedAt = now;
        }
        await _repository.SaveChangesAsync(cancellationToken);
        return ToDto(article);
    }

    public async Task<AiKnowledgeArticleDto?> ArchiveKnowledgeAsync(
        Guid id, string changeNote, string? userId, CancellationToken cancellationToken = default)
    {
        var article = await _repository.GetArticleAsync(id, cancellationToken);
        if (article is null) return null;
        if (article.PublicationStatus == AiKnowledgePublicationStatus.Archived) return ToDto(article);
        var now = _timeProvider.GetUtcNow();
        article.PublicationStatus = AiKnowledgePublicationStatus.Archived;
        article.DraftSnapshotJson = null;
        article.UpdatedAt = now;
        article.UpdatedByUserId = userId;
        article.CurrentVersion++;
        _repository.AddRevision(CreateRevision(article, "Archived", RequireChangeNote(changeNote), userId, now));
        await _repository.SaveChangesAsync(cancellationToken);
        return ToDto(article);
    }

    public async Task<AiKnowledgeArticleDto?> MarkReviewedAsync(
        Guid id, DateOnly? nextReviewAt, string changeNote, string? userId, CancellationToken cancellationToken = default)
    {
        var article = await _repository.GetArticleAsync(id, cancellationToken);
        if (article is null) return null;
        if (article.PublicationStatus != AiKnowledgePublicationStatus.Published)
            throw new AiKnowledgeStudioException("ArticleNotPublished", "Only published knowledge can be marked reviewed.", 409);
        var reviewAt = nextReviewAt ?? Today.AddDays(90);
        if (reviewAt <= Today)
            throw new AiKnowledgeStudioException("InvalidReviewDate", "The next review date must be in the future.");
        var now = _timeProvider.GetUtcNow();
        article.ReviewAt = reviewAt;
        article.UpdatedAt = now;
        article.UpdatedByUserId = userId;
        article.CurrentVersion++;
        if (article.DraftSnapshotJson is null) article.PublishedVersion = article.CurrentVersion;
        _repository.AddRevision(CreateRevision(article, "MarkedReviewed", RequireChangeNote(changeNote), userId, now));
        await _repository.SaveChangesAsync(cancellationToken);
        return ToDto(article);
    }

    public async Task<IReadOnlyList<AiKnowledgeRevisionDto>> GetRevisionsAsync(Guid id, CancellationToken cancellationToken = default)
    {
        if (await _repository.GetArticleAsync(id, cancellationToken) is null) return [];
        return (await _repository.GetRevisionsAsync(id, cancellationToken)).Select(ToRevisionDto).ToList();
    }

    public async Task<AiKnowledgeArticleDto?> RollbackAsync(
        Guid id, Guid revisionId, string changeNote, string? userId, CancellationToken cancellationToken = default)
    {
        var article = await _repository.GetArticleAsync(id, cancellationToken);
        if (article is null) return null;
        var revision = await _repository.GetRevisionAsync(id, revisionId, cancellationToken);
        if (revision is null) throw new AiKnowledgeStudioException("RevisionNotFound", "The selected revision was not found.", 404);
        var snapshot = DeserializeSnapshot(revision.SnapshotJson);
        var input = ToInput(snapshot, changeNote);
        var normalized = NormalizeAndValidate(input, requireAnswer: true);
        await EnsureUniqueKeyAsync(normalized.Key, article.Id, cancellationToken);
        var conflicts = await CheckConflictsAsync(input, article.Id, cancellationToken);
        if (!conflicts.CanPublish)
            throw new AiKnowledgeStudioException("CapabilityConflict", "The selected revision conflicts with current capability truth.", 409);

        var now = _timeProvider.GetUtcNow();
        ApplySnapshot(article, FromInput(normalized), now);
        article.PublicationStatus = AiKnowledgePublicationStatus.Published;
        article.PublishedAt = now;
        article.UpdatedAt = now;
        article.UpdatedByUserId = userId;
        article.DraftSnapshotJson = null;
        article.CurrentVersion++;
        article.PublishedVersion = article.CurrentVersion;
        _repository.AddRevision(CreateRevision(article, "RolledBack", RequireChangeNote(changeNote), userId, now));
        await _repository.SaveChangesAsync(cancellationToken);
        return ToDto(article);
    }

    public async Task<AiKnowledgeArticleDto> CreateOverrideAsync(
        string builtInKey, string? userId, CancellationToken cancellationToken = default)
    {
        var source = _embedded.GetArticles().FirstOrDefault(article => article.Key.Equals(builtInKey, StringComparison.Ordinal));
        if (source is null) throw new AiKnowledgeStudioException("BuiltInNotFound", "The built-in article was not found.", 404);
        var key = await UniqueKeyAsync(source.Key.Replace('.', '-') + "-override", cancellationToken);
        var aliases = source.Aliases.Select(text => new AiKnowledgeAliasInput(DetectLanguage(text), text)).ToList();
        return await CreateKnowledgeAsync(new AiKnowledgeArticleInput(
            key, source.Title, source.Category, source.AnswerAr, source.AnswerEn, source.Source, 10,
            source.Status == WesalKnowledgeStatus.Verified ? AiKnowledgeVerificationStatus.Verified : AiKnowledgeVerificationStatus.NeedsVerification,
            null, null, null, source.Key, aliases, "Draft created as a dynamic override of built-in knowledge."), userId, cancellationToken);
    }

    public async Task<AiKnowledgeArticleDto> DuplicateAsDraftAsync(
        Guid id, string? userId, CancellationToken cancellationToken = default)
    {
        var source = await _repository.GetArticleAsync(id, cancellationToken);
        if (source is null) throw new AiKnowledgeStudioException("ArticleNotFound", "The knowledge article was not found.", 404);
        var snapshot = ReadDraftSnapshot(source) ?? Capture(source);
        var newKey = await UniqueKeyAsync(snapshot.Key + "-copy", cancellationToken);
        return await CreateKnowledgeAsync(ToInput(snapshot with { Key = newKey, OverridesBuiltInKey = null },
            "Draft duplicated from existing knowledge."), userId, cancellationToken);
    }

    public async Task<int> GetUnresolvedGapCountAsync(CancellationToken cancellationToken = default)
        => await _repository.CountGapsAsync(AiKnowledgeGapStatus.New, cancellationToken)
            + await _repository.CountGapsAsync(AiKnowledgeGapStatus.Reviewed, cancellationToken);

    private DateOnly Today => DateOnly.FromDateTime(_timeProvider.GetUtcNow().UtcDateTime);

    private static bool IsActive(AiKnowledgeArticle article, DateOnly today)
        => article.PublicationStatus == AiKnowledgePublicationStatus.Published
            && (!article.EffectiveFrom.HasValue || article.EffectiveFrom.Value <= today)
            && (!article.EffectiveUntil.HasValue || article.EffectiveUntil.Value >= today);

    private static string DetectLanguage(string text)
        => text.Any(c => c is >= '\u0600' and <= '\u06ff') ? "ar" : "en";

    private async Task EnsureUniqueKeyAsync(string key, Guid? excludedId, CancellationToken cancellationToken)
    {
        if (await _repository.ArticleKeyExistsAsync(key, excludedId, cancellationToken))
            throw new AiKnowledgeStudioException("DuplicateKey", "An article with this key already exists.", 409,
                new Dictionary<string, string[]> { ["key"] = ["An article with this key already exists."] });
        var all = await _repository.ListArticlesAsync(cancellationToken);
        foreach (var article in all.Where(article => !excludedId.HasValue || article.Id != excludedId.Value))
        {
            var pending = ReadDraftSnapshot(article);
            if (pending is not null && pending.Key.Equals(key, StringComparison.OrdinalIgnoreCase))
                throw new AiKnowledgeStudioException("DuplicateKey", "An article draft with this key already exists.", 409);
        }
    }

    private async Task<string> UniqueKeyAsync(string requested, CancellationToken cancellationToken)
    {
        var stem = requested.Length > 105 ? requested[..105].TrimEnd('-', '.') : requested;
        var candidate = stem;
        var suffix = 2;
        while (await _repository.ArticleKeyExistsAsync(candidate, null, cancellationToken))
        {
            candidate = string.Concat(stem, "-", suffix++);
        }
        return candidate;
    }

    private static string RequireChangeNote(string? note)
    {
        var safe = note?.Trim();
        if (string.IsNullOrWhiteSpace(safe) || safe.Length > 500)
            throw new AiKnowledgeStudioException("InvalidChangeNote", "Add a change note of no more than 500 characters.");
        return safe;
    }

    private static NormalizedArticleInput NormalizeAndValidate(AiKnowledgeArticleInput input, bool requireAnswer)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        void Error(string key, string message) => errors[key] = [message];
        var key = input.Key?.Trim().ToLowerInvariant() ?? string.Empty;
        var title = input.Title?.Trim() ?? string.Empty;
        var category = input.Category?.Trim() ?? string.Empty;
        var answerAr = input.AnswerAr?.Trim() ?? string.Empty;
        var answerEn = input.AnswerEn?.Trim();
        var source = input.Source?.Trim() ?? string.Empty;
        var changeNote = input.ChangeNote?.Trim() ?? string.Empty;
        var aliases = input.Aliases ?? [];

        if (key.Length is < 3 or > 120 || !KeyPattern.IsMatch(key)) Error("key", "Use 3–120 lowercase letters, numbers, dots, or hyphens.");
        if (title.Length is < 3 or > 200) Error("title", "Title must be between 3 and 200 characters.");
        if (category.Length is < 2 or > 80) Error("category", "Category must be between 2 and 80 characters.");
        if (requireAnswer && string.IsNullOrWhiteSpace(answerAr)) Error("answerAr", "Add an Arabic answer before publishing.");
        if (answerAr.Length > 12000) Error("answerAr", "Arabic answer must be at most 12,000 characters.");
        if (answerEn?.Length > 12000) Error("answerEn", "English answer must be at most 12,000 characters.");
        if (HtmlTagPattern.IsMatch(answerAr) || answerEn is not null && HtmlTagPattern.IsMatch(answerEn))
            Error("answers", "Knowledge answers must be plain text; HTML markup is not allowed.");
        if (answerAr.Contains("javascript:", StringComparison.OrdinalIgnoreCase)
            || answerEn?.Contains("javascript:", StringComparison.OrdinalIgnoreCase) == true)
            Error("answers", "Executable links are not allowed in knowledge answers.");
        if (source.Length is < 3 or > 500) Error("source", "Source must be between 3 and 500 characters.");
        if (input.Priority is < 0 or > 100) Error("priority", "Priority must be between 0 and 100.");
        if (input.EffectiveFrom.HasValue && input.EffectiveUntil.HasValue && input.EffectiveUntil < input.EffectiveFrom)
            Error("effectiveUntil", "Effective until must be on or after effective from.");
        if (input.OverridesBuiltInKey?.Length > 160) Error("overridesBuiltInKey", "Built-in key is too long.");
        if (changeNote.Length is < 3 or > 500) Error("changeNote", "Change note must be between 3 and 500 characters.");
        if (aliases.Count > 30) Error("aliases", "Use at most 30 example questions or aliases.");

        var normalizedAliases = new List<AiKnowledgeAliasInput>();
        foreach (var alias in aliases.Take(31))
        {
            var text = alias.Text?.Trim() ?? string.Empty;
            var lang = alias.Language?.Trim().ToLowerInvariant() ?? string.Empty;
            if (text.Length is < 2 or > 200)
            {
                Error("aliases", "Each alias must be between 2 and 200 characters.");
                continue;
            }
            if (lang is not ("ar" or "en"))
            {
                Error("aliases", "Alias language must be ar or en.");
                continue;
            }
            normalizedAliases.Add(new AiKnowledgeAliasInput(lang, text));
        }
        if (errors.Count > 0)
            throw new AiKnowledgeStudioException("ValidationFailed", "One or more knowledge fields need attention.", 422, errors);

        var distinctAliases = normalizedAliases
            .GroupBy(alias => alias.Language + ":" + AiText.Normalize(alias.Text), StringComparer.Ordinal)
            .Select(group => group.First()).ToList();
        return new NormalizedArticleInput(key, title, category, answerAr,
            string.IsNullOrWhiteSpace(answerEn) ? null : answerEn, source, input.Priority,
            input.VerificationStatus, input.EffectiveFrom, input.EffectiveUntil, input.ReviewAt,
            string.IsNullOrWhiteSpace(input.OverridesBuiltInKey) ? null : input.OverridesBuiltInKey.Trim(),
            distinctAliases, RequireChangeNote(changeNote));
    }

    private static void ReplaceAliases(AiKnowledgeArticle article, IReadOnlyList<AiKnowledgeAliasInput> aliases, DateTimeOffset now)
    {
        var remaining = article.Aliases.ToList();
        foreach (var alias in aliases)
        {
            var normalized = AiText.Normalize(alias.Text);
            var existing = remaining.FirstOrDefault(candidate =>
                candidate.Language.Equals(alias.Language, StringComparison.OrdinalIgnoreCase)
                && candidate.NormalizedText.Equals(normalized, StringComparison.Ordinal));
            if (existing is not null)
            {
                existing.Text = alias.Text;
                remaining.Remove(existing);
                continue;
            }

            article.Aliases.Add(new AiKnowledgeAlias
            {
                ArticleId = article.Id,
                Language = alias.Language,
                Text = alias.Text,
                NormalizedText = normalized,
                CreatedAt = now
            });
        }

        foreach (var obsolete in remaining)
            article.Aliases.Remove(obsolete);
    }

    private static string BuildSearchText(AiKnowledgeArticle article)
        => AiText.Normalize(string.Join(' ', article.Key, article.Title, article.Category, article.AnswerAr,
            article.AnswerEn, article.Source, string.Join(' ', article.Aliases.Select(alias => alias.Text))));

    private static void ApplySnapshot(AiKnowledgeArticle article, AiKnowledgeSnapshot snapshot, DateTimeOffset now)
    {
        article.Key = snapshot.Key;
        article.Title = snapshot.Title;
        article.Category = snapshot.Category;
        article.AnswerAr = snapshot.AnswerAr;
        article.AnswerEn = snapshot.AnswerEn;
        article.Source = snapshot.Source;
        article.Priority = snapshot.Priority;
        article.VerificationStatus = snapshot.VerificationStatus;
        article.EffectiveFrom = snapshot.EffectiveFrom;
        article.EffectiveUntil = snapshot.EffectiveUntil;
        article.ReviewAt = snapshot.ReviewAt;
        article.OverridesBuiltInKey = snapshot.OverridesBuiltInKey;
        ReplaceAliases(article, snapshot.Aliases, now);
        article.NormalizedSearchText = BuildSearchText(article);
    }

    private static AiKnowledgeSnapshot Capture(AiKnowledgeArticle article)
        => new(article.Key, article.Title, article.Category, article.AnswerAr, article.AnswerEn, article.Source,
            article.Priority, article.VerificationStatus, article.EffectiveFrom, article.EffectiveUntil,
            article.ReviewAt, article.OverridesBuiltInKey,
            article.Aliases.OrderBy(alias => alias.Language).ThenBy(alias => alias.Text)
                .Select(alias => new AiKnowledgeAliasInput(alias.Language, alias.Text)).ToList());

    private static AiKnowledgeSnapshot FromInput(NormalizedArticleInput input)
        => new(input.Key, input.Title, input.Category, input.AnswerAr, input.AnswerEn, input.Source,
            input.Priority, input.VerificationStatus, input.EffectiveFrom, input.EffectiveUntil,
            input.ReviewAt, input.OverridesBuiltInKey, input.Aliases);

    private static AiKnowledgeSnapshot? ReadDraftSnapshot(AiKnowledgeArticle article)
    {
        if (string.IsNullOrWhiteSpace(article.DraftSnapshotJson)) return null;
        try { return DeserializeSnapshot(article.DraftSnapshotJson); }
        catch (JsonException) { return null; }
    }

    private static AiKnowledgeSnapshot DeserializeSnapshot(string json)
        => JsonSerializer.Deserialize<AiKnowledgeSnapshot>(json, JsonOptions)
            ?? throw new JsonException("Knowledge revision snapshot was empty.");

    private static AiKnowledgeArticleInput ToInput(AiKnowledgeSnapshot snapshot, string changeNote)
        => new(snapshot.Key, snapshot.Title, snapshot.Category, snapshot.AnswerAr, snapshot.AnswerEn,
            snapshot.Source, snapshot.Priority, snapshot.VerificationStatus, snapshot.EffectiveFrom,
            snapshot.EffectiveUntil, snapshot.ReviewAt, snapshot.OverridesBuiltInKey, snapshot.Aliases, changeNote);

    private AiKnowledgeRevision CreateRevision(
        AiKnowledgeArticle article, string action, string changeNote, string? userId,
        DateTimeOffset now, AiKnowledgeSnapshot? suppliedSnapshot = null)
        => new()
        {
            ArticleId = article.Id, Version = article.CurrentVersion, Action = action,
            SnapshotJson = JsonSerializer.Serialize(suppliedSnapshot ?? Capture(article), JsonOptions),
            CreatedAt = now, CreatedByUserId = userId, ChangeNote = changeNote
        };

    private AiKnowledgeArticleDto ToDto(AiKnowledgeArticle article, bool includeDraft = false)
    {
        var snapshot = includeDraft ? ReadDraftSnapshot(article) : null;
        var view = snapshot ?? Capture(article);
        return new AiKnowledgeArticleDto(
            article.Id, view.Key, view.Title, view.Category, view.AnswerAr, view.AnswerEn, view.Source,
            view.Priority, article.PublicationStatus.ToString(), view.VerificationStatus.ToString(),
            view.EffectiveFrom, view.EffectiveUntil, view.ReviewAt, article.PublishedAt, article.CreatedAt,
            article.UpdatedAt, article.CreatedByUserId, article.UpdatedByUserId, article.CurrentVersion,
            article.PublishedVersion, view.OverridesBuiltInKey, article.DraftSnapshotJson is not null, false,
            view.Aliases.Select(alias => new AiKnowledgeAliasDto(Guid.Empty, alias.Language, alias.Text)).ToList());
    }

    private static AiKnowledgeArticleDto ToBuiltInDto(EmbeddedWesalKnowledgeArticle article)
    {
        var updatedAt = new DateTimeOffset(article.LastUpdated.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
        return new AiKnowledgeArticleDto(Guid.Empty, article.Key, article.Title, article.Category,
            article.AnswerAr, article.AnswerEn, article.Source, 0, "Published", article.Status.ToString(),
            null, null, null, updatedAt, updatedAt, updatedAt, null, null, 1, 1, null, false, true,
            article.Aliases.Select(alias => new AiKnowledgeAliasDto(Guid.Empty, DetectLanguage(alias), alias)).ToList());
    }

    private static AiKnowledgeRevisionDto ToRevisionDto(AiKnowledgeRevision revision)
    {
        var snapshot = DeserializeSnapshot(revision.SnapshotJson);
        var dto = new AiKnowledgeArticleDto(revision.ArticleId, snapshot.Key, snapshot.Title, snapshot.Category,
            snapshot.AnswerAr, snapshot.AnswerEn, snapshot.Source, snapshot.Priority, "Revision",
            snapshot.VerificationStatus.ToString(), snapshot.EffectiveFrom, snapshot.EffectiveUntil, snapshot.ReviewAt,
            null, revision.CreatedAt, revision.CreatedAt, revision.CreatedByUserId, revision.CreatedByUserId,
            revision.Version, null, snapshot.OverridesBuiltInKey, false, false,
            snapshot.Aliases.Select(alias => new AiKnowledgeAliasDto(Guid.Empty, alias.Language, alias.Text)).ToList());
        return new AiKnowledgeRevisionDto(revision.Id, revision.ArticleId, revision.Version, revision.Action,
            revision.CreatedAt, revision.CreatedByUserId, revision.ChangeNote, dto);
    }

    private static AiKnowledgeGapClusterDto ToDto(AiKnowledgeGapCluster cluster)
    {
        IReadOnlyList<string> samples;
        try { samples = JsonSerializer.Deserialize<List<string>>(cluster.SampleQuestionsJson, JsonOptions)?.Take(5).ToList() ?? []; }
        catch (JsonException) { samples = []; }
        return new AiKnowledgeGapClusterDto(cluster.Id, cluster.CanonicalQuestion, cluster.Language,
            cluster.Status.ToString(), cluster.OccurrenceCount, cluster.FirstSeenAt, cluster.LastSeenAt,
            cluster.Reason.ToString(), samples, cluster.LinkedArticleId, cluster.ResolvedAt, cluster.IgnoredAt,
            cluster.MergedIntoClusterId);
    }

    private sealed record NormalizedArticleInput(
        string Key, string Title, string Category, string AnswerAr, string? AnswerEn, string Source,
        int Priority, AiKnowledgeVerificationStatus VerificationStatus, DateOnly? EffectiveFrom,
        DateOnly? EffectiveUntil, DateOnly? ReviewAt, string? OverridesBuiltInKey,
        IReadOnlyList<AiKnowledgeAliasInput> Aliases, string ChangeNote);

    private sealed record AiKnowledgeSnapshot(
        string Key, string Title, string Category, string AnswerAr, string? AnswerEn, string Source,
        int Priority, AiKnowledgeVerificationStatus VerificationStatus, DateOnly? EffectiveFrom,
        DateOnly? EffectiveUntil, DateOnly? ReviewAt, string? OverridesBuiltInKey,
        IReadOnlyList<AiKnowledgeAliasInput> Aliases);
}
