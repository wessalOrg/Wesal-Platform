using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/comments")]
public class CommentsController : ControllerBase
{
    private readonly ICommentService _commentService;

    public CommentsController(ICommentService commentService)
    {
        _commentService = commentService;
    }

    [HttpPost]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(CommentResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CommentResponse>> CreateComment(
        [FromBody] CreateCommentRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _commentService.CreateCommentAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetHallComments), new { hallId = response.HallId }, response);
    }

    [HttpGet("hall/{hallId:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<CommentResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<CommentResponse>>> GetHallComments(
        Guid hallId,
        CancellationToken cancellationToken)
    {
        var comments = await _commentService.GetHallCommentsAsync(hallId, cancellationToken);
        return Ok(comments);
    }

    /// <summary>
    /// Author-owned comment edit (Edit 22): only the comment's author may change its
    /// content, validated with the same rules as creation.
    /// </summary>
    [HttpPut("{commentId:guid}")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(CommentResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CommentResponse>> UpdateComment(
        Guid commentId,
        [FromBody] UpdateCommentRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _commentService.UpdateCommentAsync(commentId, request, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Author-owned comment deletion (Edit 22): soft-deletes, so the comment no longer
    /// appears in normal retrieval.
    /// </summary>
    [HttpDelete("{commentId:guid}")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteComment(
        Guid commentId,
        CancellationToken cancellationToken)
    {
        await _commentService.DeleteCommentAsync(commentId, cancellationToken);
        return NoContent();
    }
}
