using System.Security.Claims;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/admin/mabrouk")]
[Authorize(Policy = ApplicationPolicies.RequireAdmin)]
public sealed class AdminMabroukKnowledgeController : ControllerBase
{
    private readonly IAiKnowledgeStudioService _studio;

    public AdminMabroukKnowledgeController(IAiKnowledgeStudioService studio) => _studio = studio;

    [HttpGet("overview")]
    public Task<ActionResult<AiKnowledgeStudioOverviewDto>> Overview(CancellationToken cancellationToken)
        => Execute(() => _studio.GetOverviewAsync(cancellationToken));

    [HttpGet("knowledge")]
    public Task<ActionResult<IReadOnlyList<AiKnowledgeArticleDto>>> Knowledge(
        [FromQuery] string? search,
        [FromQuery] string? source,
        [FromQuery] string? publicationStatus,
        [FromQuery] string? verificationStatus,
        [FromQuery] string? category,
        [FromQuery] string? review,
        CancellationToken cancellationToken)
        => Execute(() => _studio.ListKnowledgeAsync(
            new AiKnowledgeListQuery(search, source, publicationStatus, verificationStatus, category, review),
            cancellationToken));

    [HttpGet("knowledge/{id:guid}")]
    public Task<ActionResult<AiKnowledgeArticleDto>> KnowledgeById(Guid id, CancellationToken cancellationToken)
        => ExecuteNullable(() => _studio.GetKnowledgeAsync(id, cancellationToken));

    [HttpPost("knowledge")]
    public Task<ActionResult<AiKnowledgeArticleDto>> CreateKnowledge(
        AiKnowledgeArticleInput input, CancellationToken cancellationToken)
        => Execute(() => _studio.CreateKnowledgeAsync(input, CurrentUserId, cancellationToken));

    [HttpPut("knowledge/{id:guid}")]
    public Task<ActionResult<AiKnowledgeArticleDto>> UpdateKnowledge(
        Guid id, AiKnowledgeArticleInput input, CancellationToken cancellationToken)
        => ExecuteNullable(() => _studio.UpdateKnowledgeAsync(id, input, CurrentUserId, cancellationToken));

    [HttpPost("knowledge/{id:guid}/publish")]
    public Task<ActionResult<AiKnowledgeArticleDto>> PublishKnowledge(
        Guid id, ChangeNoteRequest request, CancellationToken cancellationToken)
        => ExecuteNullable(() => _studio.PublishKnowledgeAsync(id, request.ChangeNote, CurrentUserId, cancellationToken));

    [HttpPost("knowledge/{id:guid}/archive")]
    public Task<ActionResult<AiKnowledgeArticleDto>> ArchiveKnowledge(
        Guid id, ChangeNoteRequest request, CancellationToken cancellationToken)
        => ExecuteNullable(() => _studio.ArchiveKnowledgeAsync(id, request.ChangeNote, CurrentUserId, cancellationToken));

    [HttpPost("knowledge/{id:guid}/mark-reviewed")]
    public Task<ActionResult<AiKnowledgeArticleDto>> MarkReviewed(
        Guid id, MarkReviewedRequest request, CancellationToken cancellationToken)
        => ExecuteNullable(() => _studio.MarkReviewedAsync(
            id, request.NextReviewAt, request.ChangeNote, CurrentUserId, cancellationToken));

    [HttpGet("knowledge/{id:guid}/revisions")]
    public Task<ActionResult<IReadOnlyList<AiKnowledgeRevisionDto>>> Revisions(Guid id, CancellationToken cancellationToken)
        => Execute(() => _studio.GetRevisionsAsync(id, cancellationToken));

    [HttpPost("knowledge/{id:guid}/rollback/{revisionId:guid}")]
    public Task<ActionResult<AiKnowledgeArticleDto>> Rollback(
        Guid id, Guid revisionId, ChangeNoteRequest request, CancellationToken cancellationToken)
        => ExecuteNullable(() => _studio.RollbackAsync(id, revisionId, request.ChangeNote, CurrentUserId, cancellationToken));

    [HttpPost("knowledge/built-in/{key}/override")]
    public Task<ActionResult<AiKnowledgeArticleDto>> CreateOverride(string key, CancellationToken cancellationToken)
        => Execute(() => _studio.CreateOverrideAsync(key, CurrentUserId, cancellationToken));

    [HttpPost("knowledge/{id:guid}/duplicate")]
    public Task<ActionResult<AiKnowledgeArticleDto>> Duplicate(Guid id, CancellationToken cancellationToken)
        => Execute(() => _studio.DuplicateAsDraftAsync(id, CurrentUserId, cancellationToken));

    [HttpPost("knowledge/ai-draft")]
    public Task<ActionResult<AiKnowledgeDraftSuggestion>> AiDraft(
        AiKnowledgeDraftRequest request, CancellationToken cancellationToken)
        => Execute(() => _studio.CreateAiDraftAsync(request, cancellationToken));

    [HttpPost("knowledge/conflict-check")]
    public Task<ActionResult<AiKnowledgeConflictResult>> ConflictCheck(
        AiKnowledgeArticleInput input, CancellationToken cancellationToken)
        => Execute(() => _studio.CheckConflictsAsync(input, null, cancellationToken));

    [HttpGet("unanswered")]
    public Task<ActionResult<IReadOnlyList<AiKnowledgeGapClusterDto>>> Unanswered(
        [FromQuery] bool unresolvedOnly = true, CancellationToken cancellationToken = default)
        => Execute(() => _studio.ListGapsAsync(unresolvedOnly, cancellationToken));

    [HttpGet("unanswered/count")]
    public async Task<ActionResult<object>> UnansweredCount(CancellationToken cancellationToken)
    {
        try { return Ok(new { count = await _studio.GetUnresolvedGapCountAsync(cancellationToken) }); }
        catch (AiKnowledgeStudioException exception) { return Error(exception); }
    }

    [HttpGet("unanswered/{id:guid}")]
    public Task<ActionResult<AiKnowledgeGapClusterDto>> UnansweredById(Guid id, CancellationToken cancellationToken)
        => ExecuteNullable(() => _studio.GetGapAsync(id, cancellationToken));

    [HttpPost("unanswered/{id:guid}/review")]
    public Task<ActionResult<AiKnowledgeGapClusterDto>> ReviewGap(Guid id, CancellationToken cancellationToken)
        => ExecuteNullable(() => _studio.ReviewGapAsync(id, cancellationToken));

    [HttpPost("unanswered/{id:guid}/ignore")]
    public Task<ActionResult<AiKnowledgeGapClusterDto>> IgnoreGap(Guid id, CancellationToken cancellationToken)
        => ExecuteNullable(() => _studio.IgnoreGapAsync(id, cancellationToken));

    [HttpPost("unanswered/{id:guid}/link")]
    public Task<ActionResult<AiKnowledgeGapClusterDto>> LinkGap(
        Guid id, AiKnowledgeGapLinkRequest request, CancellationToken cancellationToken)
        => ExecuteNullable(() => _studio.LinkGapAsync(id, request.ArticleId, cancellationToken));

    [HttpPost("unanswered/{id:guid}/create-article")]
    public Task<ActionResult<AiKnowledgeArticleDto>> CreateArticleFromGap(Guid id, CancellationToken cancellationToken)
        => ExecuteNullable(() => _studio.CreateArticleFromGapAsync(id, CurrentUserId, cancellationToken));

    [HttpPost("unanswered/merge")]
    public Task<ActionResult<IReadOnlyList<AiKnowledgeGapClusterDto>>> MergeGaps(
        AiKnowledgeGapMergeRequest request, CancellationToken cancellationToken)
        => Execute(() => _studio.MergeGapsAsync(request, cancellationToken));

    [HttpPost("unanswered/ai-cluster-suggestions")]
    public Task<ActionResult<IReadOnlyList<AiKnowledgeGapClusterSuggestion>>> SuggestGapClusters(CancellationToken cancellationToken)
        => Execute(() => _studio.SuggestGapClustersAsync(cancellationToken));

    [HttpPost("simulate")]
    public Task<ActionResult<AiKnowledgeSimulatorResult>> Simulate(
        AiKnowledgeSimulatorRequest request, CancellationToken cancellationToken)
        => Execute(() => _studio.SimulateAsync(request, cancellationToken));

    [HttpGet("analytics")]
    public Task<ActionResult<AiKnowledgeAnalyticsDto>> Analytics(CancellationToken cancellationToken)
        => Execute(() => _studio.GetAnalyticsAsync(cancellationToken));

    [HttpGet("export")]
    public async Task<IActionResult> Export(CancellationToken cancellationToken)
    {
        try { return Ok(await _studio.ExportAsync(cancellationToken)); }
        catch (AiKnowledgeStudioException exception) { return Error(exception); }
    }

    private string? CurrentUserId => User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);

    private async Task<ActionResult<T>> Execute<T>(Func<Task<T>> action)
    {
        try { return Ok(await action()); }
        catch (AiKnowledgeStudioException exception) { return Error(exception); }
    }

    private async Task<ActionResult<T>> ExecuteNullable<T>(Func<Task<T?>> action) where T : class
    {
        try
        {
            var result = await action();
            return result is null ? NotFound() : Ok(result);
        }
        catch (AiKnowledgeStudioException exception) { return Error(exception); }
    }

    private ObjectResult Error(AiKnowledgeStudioException exception)
        => StatusCode(exception.StatusCode, new
        {
            code = exception.Code,
            message = exception.Message,
            errors = exception.Errors
        });
}

public sealed record ChangeNoteRequest(string ChangeNote);
public sealed record MarkReviewedRequest(DateOnly? NextReviewAt, string ChangeNote);
