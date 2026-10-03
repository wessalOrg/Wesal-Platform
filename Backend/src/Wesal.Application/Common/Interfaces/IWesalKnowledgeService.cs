using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Retrieves bounded, official Wesal support knowledge. Implementations may later
/// use a search index or vector store, but callers must not depend on either.
/// </summary>
public interface IWesalKnowledgeService
{
    Task<IReadOnlyList<WesalKnowledgeArticle>> SearchAsync(
        string question,
        string? language,
        int maxResults = 3,
        CancellationToken cancellationToken = default);
}

/// <summary>Diagnostics for the knowledge base (how many articles were actually loaded).</summary>
public interface IWesalKnowledgeStats
{
    int ArticleCount { get; }
}
