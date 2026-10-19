using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IAiKnowledgeStudioService
{
    Task<AiKnowledgeStudioOverviewDto> GetOverviewAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AiKnowledgeArticleDto>> ListKnowledgeAsync(AiKnowledgeListQuery query, CancellationToken cancellationToken = default);
    Task<AiKnowledgeArticleDto?> GetKnowledgeAsync(Guid id, CancellationToken cancellationToken = default);
    Task<AiKnowledgeArticleDto> CreateKnowledgeAsync(AiKnowledgeArticleInput input, string? userId, CancellationToken cancellationToken = default);
    Task<AiKnowledgeArticleDto?> UpdateKnowledgeAsync(Guid id, AiKnowledgeArticleInput input, string? userId, CancellationToken cancellationToken = default);
    Task<AiKnowledgeArticleDto?> PublishKnowledgeAsync(Guid id, string changeNote, string? userId, CancellationToken cancellationToken = default);
    Task<AiKnowledgeArticleDto?> ArchiveKnowledgeAsync(Guid id, string changeNote, string? userId, CancellationToken cancellationToken = default);
    Task<AiKnowledgeArticleDto?> MarkReviewedAsync(Guid id, DateOnly? nextReviewAt, string changeNote, string? userId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AiKnowledgeRevisionDto>> GetRevisionsAsync(Guid id, CancellationToken cancellationToken = default);
    Task<AiKnowledgeArticleDto?> RollbackAsync(Guid id, Guid revisionId, string changeNote, string? userId, CancellationToken cancellationToken = default);
    Task<AiKnowledgeArticleDto> CreateOverrideAsync(string builtInKey, string? userId, CancellationToken cancellationToken = default);
    Task<AiKnowledgeArticleDto> DuplicateAsDraftAsync(Guid id, string? userId, CancellationToken cancellationToken = default);
    Task<AiKnowledgeConflictResult> CheckConflictsAsync(AiKnowledgeArticleInput input, Guid? excludedArticleId = null, CancellationToken cancellationToken = default);
    Task<AiKnowledgeDraftSuggestion> CreateAiDraftAsync(AiKnowledgeDraftRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AiKnowledgeGapClusterDto>> ListGapsAsync(bool unresolvedOnly = true, CancellationToken cancellationToken = default);
    Task<AiKnowledgeGapClusterDto?> GetGapAsync(Guid id, CancellationToken cancellationToken = default);
    Task<AiKnowledgeGapClusterDto?> ReviewGapAsync(Guid id, CancellationToken cancellationToken = default);
    Task<AiKnowledgeGapClusterDto?> IgnoreGapAsync(Guid id, CancellationToken cancellationToken = default);
    Task<AiKnowledgeGapClusterDto?> LinkGapAsync(Guid id, Guid articleId, CancellationToken cancellationToken = default);
    Task<AiKnowledgeArticleDto?> CreateArticleFromGapAsync(Guid id, string? userId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AiKnowledgeGapClusterDto>> MergeGapsAsync(AiKnowledgeGapMergeRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AiKnowledgeGapClusterSuggestion>> SuggestGapClustersAsync(CancellationToken cancellationToken = default);
    Task<AiKnowledgeSimulatorResult> SimulateAsync(AiKnowledgeSimulatorRequest request, CancellationToken cancellationToken = default);
    Task<AiKnowledgeAnalyticsDto> GetAnalyticsAsync(CancellationToken cancellationToken = default);
    Task<AiKnowledgeExportDto> ExportAsync(CancellationToken cancellationToken = default);
    Task<int> GetUnresolvedGapCountAsync(CancellationToken cancellationToken = default);
}
