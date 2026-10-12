namespace Wesal.Domain.Entities;

public enum AiKnowledgePublicationStatus
{
    Draft,
    Published,
    Archived
}

public enum AiKnowledgeVerificationStatus
{
    Verified,
    NeedsVerification
}

public sealed class AiKnowledgeArticle
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Key { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string AnswerAr { get; set; } = string.Empty;
    public string? AnswerEn { get; set; }
    public string Source { get; set; } = string.Empty;
    public int Priority { get; set; }
    public AiKnowledgePublicationStatus PublicationStatus { get; set; }
    public AiKnowledgeVerificationStatus VerificationStatus { get; set; }
    public DateOnly? EffectiveFrom { get; set; }
    public DateOnly? EffectiveUntil { get; set; }
    public DateOnly? ReviewAt { get; set; }
    public DateTimeOffset? PublishedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public string? CreatedByUserId { get; set; }
    public string? UpdatedByUserId { get; set; }
    public int CurrentVersion { get; set; }
    public int? PublishedVersion { get; set; }
    public string? OverridesBuiltInKey { get; set; }
    public string? DraftSnapshotJson { get; set; }
    public string NormalizedSearchText { get; set; } = string.Empty;

    public ICollection<AiKnowledgeAlias> Aliases { get; set; } = new List<AiKnowledgeAlias>();
    public ICollection<AiKnowledgeRevision> Revisions { get; set; } = new List<AiKnowledgeRevision>();
}

public sealed class AiKnowledgeAlias
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ArticleId { get; set; }
    public string Language { get; set; } = "ar";
    public string Text { get; set; } = string.Empty;
    public string NormalizedText { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public AiKnowledgeArticle Article { get; set; } = null!;
}

public sealed class AiKnowledgeRevision
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ArticleId { get; set; }
    public int Version { get; set; }
    public string Action { get; set; } = string.Empty;
    public string SnapshotJson { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public string? CreatedByUserId { get; set; }
    public string ChangeNote { get; set; } = string.Empty;
    public AiKnowledgeArticle Article { get; set; } = null!;
}

public enum AiKnowledgeGapStatus
{
    New,
    Reviewed,
    Resolved,
    Ignored
}

public enum AiKnowledgeGapReason
{
    NoTrustedKnowledge,
    GenericFallback,
    NegativeFeedback,
    Other
}

public sealed class AiKnowledgeGapCluster
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string CanonicalQuestion { get; set; } = string.Empty;
    public string NormalizedKey { get; set; } = string.Empty;
    public string Language { get; set; } = "ar";
    public AiKnowledgeGapStatus Status { get; set; }
    public int OccurrenceCount { get; set; }
    public DateTimeOffset FirstSeenAt { get; set; }
    public DateTimeOffset LastSeenAt { get; set; }
    public AiKnowledgeGapReason Reason { get; set; }
    public string SampleQuestionsJson { get; set; } = "[]";
    public Guid? LinkedArticleId { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
    public DateTimeOffset? IgnoredAt { get; set; }
    public Guid? MergedIntoClusterId { get; set; }
    public AiKnowledgeArticle? LinkedArticle { get; set; }
}
