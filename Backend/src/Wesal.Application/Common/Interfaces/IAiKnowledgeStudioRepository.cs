using Wesal.Domain.Entities;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IAiKnowledgeStudioRepository
{
    Task<IReadOnlyList<AiKnowledgeArticle>> ListArticlesAsync(CancellationToken cancellationToken = default);
    Task<AiKnowledgeArticle?> GetArticleAsync(Guid id, CancellationToken cancellationToken = default);
    Task<bool> ArticleKeyExistsAsync(string key, Guid? excludedArticleId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AiKnowledgeArticle>> SearchPublishedCandidatesAsync(IReadOnlyList<string> normalizedTokens, DateOnly today, int maximumResults = 100, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AiKnowledgeRevision>> GetRevisionsAsync(Guid articleId, CancellationToken cancellationToken = default);
    Task<AiKnowledgeRevision?> GetRevisionAsync(Guid articleId, Guid revisionId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AiKnowledgeGapCluster>> ListGapsAsync(bool unresolvedOnly, int maximumResults = 500, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AiKnowledgeGapCluster>> GetUnresolvedGapsLinkedToArticleAsync(Guid articleId, CancellationToken cancellationToken = default);
    Task<AiKnowledgeGapCluster?> GetGapAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AiKnowledgeGapCluster>> GetRecentUnresolvedGapsAsync(string language, int maximumResults = 300, CancellationToken cancellationToken = default);
    Task<int> CountGapsAsync(AiKnowledgeGapStatus? status = null, CancellationToken cancellationToken = default);
    Task<int> CountUnresolvedOccurrencesAsync(CancellationToken cancellationToken = default);
    void AddArticle(AiKnowledgeArticle article);
    void AddRevision(AiKnowledgeRevision revision);
    void AddGap(AiKnowledgeGapCluster cluster);
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

public interface IEmbeddedWesalKnowledgeSource : IWesalKnowledgeService
{
    IReadOnlyList<EmbeddedWesalKnowledgeArticle> GetArticles();
}
