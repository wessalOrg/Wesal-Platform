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
    public async Task<ActionResult<IReadOnlyList<CommentResponse>>> GetHallComments(
        Guid hallId,
        CancellationToken cancellationToken)
    {
        var comments = await _commentService.GetHallCommentsAsync(hallId, cancellationToken);
        return Ok(comments);
    }
}
