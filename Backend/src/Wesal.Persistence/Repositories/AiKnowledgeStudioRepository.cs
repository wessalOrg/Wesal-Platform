using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public sealed class AiKnowledgeStudioRepository : IAiKnowledgeStudioRepository
{
    private readonly ApplicationDbContext _context;

    public AiKnowledgeStudioRepository(ApplicationDbContext context) => _context = context;

    public async Task<IReadOnlyList<AiKnowledgeArticle>> ListArticlesAsync(CancellationToken cancellationToken = default)
        => await _context.AiKnowledgeArticles
            .Include(article => article.Aliases)
            .OrderByDescending(article => article.UpdatedAt)
            .ToListAsync(cancellationToken);

    public Task<AiKnowledgeArticle?> GetArticleAsync(Guid id, CancellationToken cancellationToken = default)
        => _context.AiKnowledgeArticles
            .Include(article => article.Aliases)
            .FirstOrDefaultAsync(article => article.Id == id, cancellationToken);

    public Task<bool> ArticleKeyExistsAsync(
        string key,
        Guid? excludedArticleId = null,
        CancellationToken cancellationToken = default)
        => _context.AiKnowledgeArticles.AnyAsync(
            article => article.Key == key && (!excludedArticleId.HasValue || article.Id != excludedArticleId.Value),
            cancellationToken);

    public async Task<IReadOnlyList<AiKnowledgeArticle>> SearchPublishedCandidatesAsync(
        IReadOnlyList<string> normalizedTokens,
        DateOnly today,
        int maximumResults = 100,
        CancellationToken cancellationToken = default)
    {
        var query = _context.AiKnowledgeArticles
            .AsNoTracking()
            .Include(article => article.Aliases)
            .Where(article => article.PublicationStatus == AiKnowledgePublicationStatus.Published
                && (!article.EffectiveFrom.HasValue || article.EffectiveFrom.Value <= today)
                && (!article.EffectiveUntil.HasValue || article.EffectiveUntil.Value >= today));

        if (normalizedTokens.Count > 0)
        {
            var parameter = Expression.Parameter(typeof(AiKnowledgeArticle), "article");
            Expression match = Expression.Constant(false);
            var searchText = Expression.Property(parameter, nameof(AiKnowledgeArticle.NormalizedSearchText));
            var contains = typeof(string).GetMethod(nameof(string.Contains), [typeof(string)])!;
            foreach (var token in normalizedTokens.Where(token => token.Length >= 2).Distinct(StringComparer.Ordinal))
            {
                match = Expression.OrElse(match, Expression.Call(searchText, contains, Expression.Constant(token)));
            }

            if (match is not ConstantExpression { Value: false })
            {
                query = query.Where(Expression.Lambda<Func<AiKnowledgeArticle, bool>>(match, parameter));
            }
            else
            {
                return [];
            }
        }

        return await query
            .OrderByDescending(article => article.Priority)
            .ThenByDescending(article => article.UpdatedAt)
            .Take(Math.Clamp(maximumResults, 1, 250))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AiKnowledgeRevision>> GetRevisionsAsync(Guid articleId, CancellationToken cancellationToken = default)
        => await _context.AiKnowledgeRevisions
            .AsNoTracking()
            .Where(revision => revision.ArticleId == articleId)
            .OrderByDescending(revision => revision.Version)
            .ToListAsync(cancellationToken);

    public Task<AiKnowledgeRevision?> GetRevisionAsync(Guid articleId, Guid revisionId, CancellationToken cancellationToken = default)
        => _context.AiKnowledgeRevisions.AsNoTracking()
            .FirstOrDefaultAsync(revision => revision.ArticleId == articleId && revision.Id == revisionId, cancellationToken);

    public async Task<IReadOnlyList<AiKnowledgeGapCluster>> ListGapsAsync(
        bool unresolvedOnly,
        int maximumResults = 500,
        CancellationToken cancellationToken = default)
    {
        var query = _context.AiKnowledgeGapClusters.AsNoTracking().AsQueryable();
        if (unresolvedOnly)
        {
            query = query.Where(cluster => cluster.Status == AiKnowledgeGapStatus.New
                || cluster.Status == AiKnowledgeGapStatus.Reviewed);
        }

        return await query
            .OrderByDescending(cluster => cluster.LastSeenAt)
            .Take(Math.Clamp(maximumResults, 1, 1000))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AiKnowledgeGapCluster>> GetUnresolvedGapsLinkedToArticleAsync(
        Guid articleId,
        CancellationToken cancellationToken = default)
        => await _context.AiKnowledgeGapClusters
            .Where(cluster => cluster.LinkedArticleId == articleId
                && (cluster.Status == AiKnowledgeGapStatus.New || cluster.Status == AiKnowledgeGapStatus.Reviewed))
            .ToListAsync(cancellationToken);

    public Task<AiKnowledgeGapCluster?> GetGapAsync(Guid id, CancellationToken cancellationToken = default)
        => _context.AiKnowledgeGapClusters.FirstOrDefaultAsync(cluster => cluster.Id == id, cancellationToken);

    public async Task<IReadOnlyList<AiKnowledgeGapCluster>> GetRecentUnresolvedGapsAsync(
        string language,
        int maximumResults = 300,
        CancellationToken cancellationToken = default)
        => await _context.AiKnowledgeGapClusters
            .Where(cluster => cluster.Language == language
                && (cluster.Status == AiKnowledgeGapStatus.New || cluster.Status == AiKnowledgeGapStatus.Reviewed))
            .OrderByDescending(cluster => cluster.LastSeenAt)
            .Take(Math.Clamp(maximumResults, 1, 500))
            .ToListAsync(cancellationToken);

    public Task<int> CountGapsAsync(AiKnowledgeGapStatus? status = null, CancellationToken cancellationToken = default)
    {
        var query = _context.AiKnowledgeGapClusters.AsQueryable();
        if (status.HasValue)
        {
            query = query.Where(cluster => cluster.Status == status.Value);
        }

        return query.CountAsync(cancellationToken);
    }

    public async Task<int> CountUnresolvedOccurrencesAsync(CancellationToken cancellationToken = default)
        => await _context.AiKnowledgeGapClusters
            .Where(cluster => cluster.Status == AiKnowledgeGapStatus.New || cluster.Status == AiKnowledgeGapStatus.Reviewed)
            .SumAsync(cluster => (int?)cluster.OccurrenceCount, cancellationToken)
            ?? 0;

    public void AddArticle(AiKnowledgeArticle article) => _context.AiKnowledgeArticles.Add(article);

    public void AddRevision(AiKnowledgeRevision revision) => _context.AiKnowledgeRevisions.Add(revision);

    public void AddGap(AiKnowledgeGapCluster cluster) => _context.AiKnowledgeGapClusters.Add(cluster);

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        => _context.SaveChangesAsync(cancellationToken);
}
