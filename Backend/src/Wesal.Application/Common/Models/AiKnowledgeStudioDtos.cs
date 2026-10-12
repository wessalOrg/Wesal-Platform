using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Models;

public sealed record EmbeddedWesalKnowledgeArticle(
    string Key,
    string Title,
    string Category,
    string Source,
    DateOnly LastUpdated,
    WesalKnowledgeStatus Status,
    string AnswerAr,
    string AnswerEn,
    IReadOnlyList<string> Aliases);

public sealed record AiKnowledgeAliasInput(string Language, string Text);

public sealed record AiKnowledgeArticleInput(
    string Key,
    string Title,
    string Category,
    string AnswerAr,
    string? AnswerEn,
    string Source,
    int Priority,
    AiKnowledgeVerificationStatus VerificationStatus,
    DateOnly? EffectiveFrom,
    DateOnly? EffectiveUntil,
    DateOnly? ReviewAt,
    string? OverridesBuiltInKey,
    IReadOnlyList<AiKnowledgeAliasInput> Aliases,
    string ChangeNote);

public sealed record AiKnowledgeAliasDto(Guid Id, string Language, string Text);

public sealed record AiKnowledgeArticleDto(
    Guid Id,
    string Key,
    string Title,
    string Category,
    string AnswerAr,
    string? AnswerEn,
    string Source,
    int Priority,
    string PublicationStatus,
    string VerificationStatus,
    DateOnly? EffectiveFrom,
    DateOnly? EffectiveUntil,
    DateOnly? ReviewAt,
    DateTimeOffset? PublishedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    string? CreatedByUserId,
    string? UpdatedByUserId,
    int CurrentVersion,
    int? PublishedVersion,
    string? OverridesBuiltInKey,
    bool HasUnpublishedDraft,
    bool IsBuiltIn,
    IReadOnlyList<AiKnowledgeAliasDto> Aliases);

public sealed record AiKnowledgeRevisionDto(
    Guid Id,
    Guid ArticleId,
    int Version,
    string Action,
    DateTimeOffset CreatedAt,
    string? CreatedByUserId,
    string ChangeNote,
    AiKnowledgeArticleDto Snapshot);

public sealed record AiKnowledgeListQuery(
    string? Search = null,
    string? Source = null,
    string? PublicationStatus = null,
    string? VerificationStatus = null,
    string? Category = null,
    string? Review = null);

public sealed record AiKnowledgeStudioOverviewDto(
    int PublishedDynamicKnowledge,
    int Drafts,
    int BuiltInArticles,
    int UnansweredClusters,
    int TotalUnresolvedOccurrences,
    int NeedsReview,
    int Expired,
    int ExpiringSoon,
    int ResolvedClusters,
    IReadOnlyList<AiKnowledgeGapClusterDto> RecentUnanswered,
    IReadOnlyList<AiKnowledgeArticleDto> RecentlyPublished,
    IReadOnlyList<AiKnowledgeArticleDto> NeedsReviewArticles);

public sealed record AiKnowledgeGapCandidate(
    string Question,
    string? Language,
    AiKnowledgeGapReason Reason,
    string? AssistantRoute,
    DateTimeOffset? OccurredAt);

public sealed record AiKnowledgeGapClusterDto(
    Guid Id,
    string CanonicalQuestion,
    string Language,
    string Status,
    int OccurrenceCount,
    DateTimeOffset FirstSeenAt,
    DateTimeOffset LastSeenAt,
    string Reason,
    IReadOnlyList<string> SampleQuestions,
    Guid? LinkedArticleId,
    DateTimeOffset? ResolvedAt,
    DateTimeOffset? IgnoredAt,
    Guid? MergedIntoClusterId);

public sealed record AiKnowledgeGapLinkRequest(Guid ArticleId);

public sealed record AiKnowledgeGapMergeRequest(Guid TargetClusterId, IReadOnlyList<Guid> ClusterIds);

public sealed record AiKnowledgeGapClusterSuggestion(
    IReadOnlyList<Guid> ClusterIds,
    string Explanation,
    double Confidence);

public sealed record AiKnowledgeDraftRequest(string RoughInput, string? Language = null);

public sealed record AiKnowledgeDraftSuggestion(
    string Title,
    string Category,
    string AnswerAr,
    string? AnswerEn,
    IReadOnlyList<string> AliasesAr,
    IReadOnlyList<string> AliasesEn,
    string SuggestedSource,
    DateOnly? SuggestedReviewDate,
    IReadOnlyList<string> PotentialConflicts,
    string ConfidenceNotes);

public sealed record AiKnowledgeConflict(string Code, string Severity, string Message, string? ExistingSource = null);

public sealed record AiKnowledgeConflictResult(IReadOnlyList<AiKnowledgeConflict> Conflicts)
{
    public bool CanPublish => Conflicts.All(item => !string.Equals(item.Severity, "block", StringComparison.OrdinalIgnoreCase));
}

public sealed record AiKnowledgeSimulatorRequest(
    string Question,
    string? Language = null,
    bool TestDraft = false,
    Guid? DraftArticleId = null,
    bool FullAssistant = false,
    string? PagePath = null,
    string? HallId = null);

public sealed record AiKnowledgeSimulatorResult(
    string Answer,
    string SourceType,
    string? ArticleKey,
    string? ArticleTitle,
    string PublicationStatus,
    string VerificationStatus,
    IReadOnlyList<string> MatchedAliases,
    int? Score,
    bool? GeminiUsed,
    int? ProviderCallCount,
    bool DraftOnly,
    string? AssistantKind = null);

public sealed record AiKnowledgeAnalyticsDto(
    int Published,
    int Draft,
    int BuiltIn,
    int NeedsReview,
    int Expired,
    int ExpiringSoon,
    int UnansweredClusters,
    int TotalUnresolvedOccurrences,
    int ResolvedClusters,
    IReadOnlyList<AiKnowledgeGapClusterDto> TopUnresolvedTopics,
    IReadOnlyList<AiKnowledgeArticleDto> RecentlyUpdated);

public sealed record AiKnowledgeExportDto(
    string SchemaVersion,
    DateTimeOffset ExportedAt,
    IReadOnlyList<AiKnowledgeExportArticle> Articles);

public sealed record AiKnowledgeExportArticle(
    string Key,
    string Title,
    string Category,
    string AnswerAr,
    string? AnswerEn,
    string Source,
    int Priority,
    string PublicationStatus,
    string VerificationStatus,
    DateOnly? EffectiveFrom,
    DateOnly? EffectiveUntil,
    DateOnly? ReviewAt,
    string? OverridesBuiltInKey,
    IReadOnlyList<AiKnowledgeAliasDto> Aliases);

public sealed class AiKnowledgeStudioException : Exception
{
    public AiKnowledgeStudioException(string code, string message, int statusCode = 422, IReadOnlyDictionary<string, string[]>? errors = null)
        : base(message)
    {
        Code = code;
        StatusCode = statusCode;
        Errors = errors ?? new Dictionary<string, string[]>();
    }

    public string Code { get; }
    public int StatusCode { get; }
    public IReadOnlyDictionary<string, string[]> Errors { get; }
}
