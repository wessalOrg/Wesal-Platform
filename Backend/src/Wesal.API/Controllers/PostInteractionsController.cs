using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}")]
public sealed class PostInteractionsController(IPostInteractionService interactions) : ControllerBase
{
    [HttpPost("posts/{postId:guid}/comments")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(PostCommentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PostCommentDto>> CreateComment(Guid postId, [FromBody] CreatePostCommentRequest request, CancellationToken cancellationToken)
    {
        var created = await interactions.CreateCommentAsync(postId, request, cancellationToken);
        return CreatedAtAction(nameof(ListComments), new { postId, version = "1" }, created);
    }

    [HttpPost("posts/{postId:guid}/comments/{commentId:guid}/replies")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(PostCommentDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<PostCommentDto>> Reply(Guid postId, Guid commentId, [FromBody] CreatePostCommentRequest request, CancellationToken cancellationToken)
    {
        var created = await interactions.ReplyAsync(postId, commentId, request, cancellationToken);
        return CreatedAtAction(nameof(ListReplies), new { postId, commentId, version = "1" }, created);
    }

    [HttpGet("posts/{postId:guid}/comments")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PagedResult<PostCommentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PagedResult<PostCommentDto>>> ListComments(Guid postId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10, CancellationToken cancellationToken = default)
        => Ok(await interactions.ListCommentsAsync(postId, page, pageSize, cancellationToken));

    [HttpGet("posts/{postId:guid}/comments/{commentId:guid}/replies")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PagedResult<PostCommentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PagedResult<PostCommentDto>>> ListReplies(Guid postId, Guid commentId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10, CancellationToken cancellationToken = default)
        => Ok(await interactions.ListRepliesAsync(postId, commentId, page, pageSize, cancellationToken));

    [HttpDelete("posts/{postId:guid}/comments/{commentId:guid}")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteComment(Guid postId, Guid commentId, CancellationToken cancellationToken)
    {
        await interactions.DeleteCommentAsync(postId, commentId, cancellationToken);
        return NoContent();
    }

    [HttpPost("posts/{postId:guid}/favorites")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddFavorite(Guid postId, CancellationToken cancellationToken)
    {
        await interactions.AddFavoriteAsync(postId, cancellationToken);
        return NoContent();
    }

    [HttpDelete("posts/{postId:guid}/favorites")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> RemoveFavorite(Guid postId, CancellationToken cancellationToken)
    {
        await interactions.RemoveFavoriteAsync(postId, cancellationToken);
        return NoContent();
    }

    [HttpGet("favorites")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(PagedResult<FavoritePostDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<PagedResult<FavoritePostDto>>> ListFavorites([FromQuery] int page = 1, [FromQuery] int pageSize = 10, CancellationToken cancellationToken = default)
        => Ok(await interactions.ListFavoritesAsync(page, pageSize, cancellationToken));
}
