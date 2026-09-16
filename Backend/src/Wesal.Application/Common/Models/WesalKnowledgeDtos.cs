namespace Wesal.Application.Common.Models;

public enum WesalKnowledgeStatus
{
    Verified,
    NeedsVerification,
    Draft
}

/// <summary>
/// A localized, bounded support article returned by the knowledge layer. The
/// status is intentional: callers must never present NeedsVerification or Draft
/// information as confirmed platform policy.
/// </summary>
public sealed record WesalKnowledgeArticle(
    string Title,
    string Category,
    string Source,
    DateOnly LastUpdated,
    WesalKnowledgeStatus Status,
    string Content);
