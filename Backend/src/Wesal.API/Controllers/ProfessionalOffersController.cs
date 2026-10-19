using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/offers")]
public sealed class ProfessionalOffersController(IProfessionalOfferService offers) : ControllerBase
{
    private const long UploadBytes = 53_000_000;

    [HttpPost]
    [Authorize(Roles = ApplicationRoles.EventCoordinator + "," + ApplicationRoles.Photographer)]
    [Authorize(Policy = ApplicationPolicies.RequireApprovedAccount)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(UploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = UploadBytes)]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromForm] string? content, [FromForm] decimal oldPrice, [FromForm] decimal offerPrice,
        [FromForm] decimal? priceBox, [FromForm] DateTimeOffset startsAt, [FromForm] DateTimeOffset endsAt,
        IFormFile[]? images, CancellationToken cancellationToken)
    {
        var id = await offers.CreateAsync(new CreateProfessionalOfferRequest
        {
            Content = content, OldPrice = oldPrice, OfferPrice = offerPrice, PriceBox = priceBox,
            StartsAt = startsAt, EndsAt = endsAt, Images = await PublishingFormFiles.BufferAsync(images, cancellationToken)
        }, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { version = "1", offerId = id }, new { id });
    }

    [HttpPut("{offerId:guid}")]
    [Authorize(Roles = ApplicationRoles.EventCoordinator + "," + ApplicationRoles.Photographer)]
    [Authorize(Policy = ApplicationPolicies.RequireApprovedAccount)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(UploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = UploadBytes)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(Guid offerId, [FromForm] string? content, [FromForm] decimal oldPrice,
        [FromForm] decimal offerPrice, [FromForm] decimal? priceBox, [FromForm] DateTimeOffset startsAt,
        [FromForm] DateTimeOffset endsAt, [FromForm] bool replaceImages, [FromForm] Guid[]? keepImageIds,
        IFormFile[]? images, CancellationToken cancellationToken)
    {
        await offers.UpdateAsync(offerId, new UpdateProfessionalOfferRequest
        {
            Content = content, OldPrice = oldPrice, OfferPrice = offerPrice, PriceBox = priceBox,
            StartsAt = startsAt, EndsAt = endsAt, ReplaceImages = replaceImages,
            KeepImageIds = keepImageIds ?? [], Images = await PublishingFormFiles.BufferAsync(images, cancellationToken)
        }, cancellationToken);
        return NoContent();
    }

    [HttpPost("{offerId:guid}/stop")]
    [Authorize(Roles = ApplicationRoles.EventCoordinator + "," + ApplicationRoles.Photographer)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Stop(Guid offerId, CancellationToken cancellationToken)
    {
        await offers.StopAsync(offerId, cancellationToken);
        return NoContent();
    }

    [HttpGet("mine")]
    [Authorize(Roles = ApplicationRoles.EventCoordinator + "," + ApplicationRoles.Photographer)]
    [ProducesResponseType(typeof(PagedResult<PublicProfileContentDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<PublicProfileContentDto>>> ListOwn([FromQuery] int page = 1,
        [FromQuery] int pageSize = 10, CancellationToken cancellationToken = default)
        => Ok(await offers.ListOwnAsync(page, pageSize, cancellationToken));

    [HttpGet("profile/{userId}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PagedResult<PublicProfileContentDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<PublicProfileContentDto>>> ListProfile(string userId, [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10, CancellationToken cancellationToken = default)
        => Ok(await offers.ListProfileAsync(userId, page, pageSize, cancellationToken));

    [HttpGet("{offerId:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PublicProfileContentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PublicProfileContentDto>> GetById(Guid offerId, CancellationToken cancellationToken)
        => Ok(await offers.GetAsync(offerId, cancellationToken));

    [HttpGet("{offerId:guid}/images/{imageId:guid}")]
    [AllowAnonymous]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetImage(Guid offerId, Guid imageId, CancellationToken cancellationToken)
    {
        var image = await offers.GetImageAsync(offerId, imageId, cancellationToken);
        return File(image.Content ?? [], image.ContentType);
    }
}
