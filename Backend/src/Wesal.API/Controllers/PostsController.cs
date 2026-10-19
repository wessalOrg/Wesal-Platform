using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/posts")]
public sealed class PostsController(IPostService posts, IPostSharingService sharing) : ControllerBase
{
    private const long UploadBytes = 53_000_000;

    [HttpPost]
    [Authorize(Roles = ApplicationRoles.EventCoordinator + "," + ApplicationRoles.Photographer)]
    [Authorize(Policy = ApplicationPolicies.RequireApprovedAccount)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(UploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = UploadBytes)]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Create([FromForm] string? content, [FromForm] decimal? price, IFormFile[]? images, CancellationToken cancellationToken)
    {
        var id = await posts.CreateAsync(new CreatePostRequest
        {
            Content = content, Price = price,
            Images = await PublishingFormFiles.BufferAsync(images, cancellationToken)
        }, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { version = "1", postId = id }, new { id });
    }

    [HttpPut("{postId:guid}")]
    [Authorize(Roles = ApplicationRoles.EventCoordinator + "," + ApplicationRoles.Photographer)]
    [Authorize(Policy = ApplicationPolicies.RequireApprovedAccount)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(UploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = UploadBytes)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid postId, [FromForm] string? content, [FromForm] decimal? price,
        [FromForm] bool replaceImages, [FromForm] Guid[]? keepImageIds, IFormFile[]? images, CancellationToken cancellationToken)
    {
        await posts.UpdateAsync(postId, new UpdatePostRequest
        {
            Content = content, Price = price, ReplaceImages = replaceImages,
            KeepImageIds = keepImageIds ?? [], Images = await PublishingFormFiles.BufferAsync(images, cancellationToken)
        }, cancellationToken);
        return NoContent();
    }

    [HttpGet("{postId:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PublicProfileContentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PublicProfileContentDto>> GetById(Guid postId, CancellationToken cancellationToken)
        => Ok(await posts.GetPublicAsync(postId, cancellationToken));

    [HttpGet("profile/{userId}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PagedResult<PublicProfileContentDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<PublicProfileContentDto>>> ListProfile(string userId, [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10, CancellationToken cancellationToken = default)
        => Ok(await posts.ListProfileAsync(userId, page, pageSize, cancellationToken));

    [HttpGet("{postId:guid}/images/{imageId:guid}")]
    [AllowAnonymous]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetImage(Guid postId, Guid imageId, CancellationToken cancellationToken)
    {
        var image = await posts.GetImageAsync(postId, imageId, cancellationToken);
        return File(image.Content ?? [], image.ContentType);
    }

    [HttpGet("{postId:guid}/share-link")]
    [AllowAnonymous]
    public async Task<ActionResult<object>> GetShareLink(Guid postId, CancellationToken cancellationToken)
        => Ok(new { shareLink = await sharing.GetShareLinkAsync(postId, cancellationToken) });

    [HttpPost("{postId:guid}/shares")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> RegisterShare(Guid postId, CancellationToken cancellationToken)
    {
        await sharing.RegisterShareAsync(postId, cancellationToken);
        return NoContent();
    }
}

internal static class PublishingFormFiles
{
    public static async Task<IReadOnlyList<OwnerDocumentUpload>> BufferAsync(IFormFile[]? files, CancellationToken cancellationToken)
    {
        if (files is null || files.Length == 0) return [];
        var uploads = new List<OwnerDocumentUpload>(files.Length);
        foreach (var file in files)
        {
            using var buffer = new MemoryStream();
            await file.CopyToAsync(buffer, cancellationToken);
            uploads.Add(new OwnerDocumentUpload { FileName = file.FileName, ContentType = file.ContentType, Content = buffer.ToArray() });
        }
        return uploads;
    }
}
