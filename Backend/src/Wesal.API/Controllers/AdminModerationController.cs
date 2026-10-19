using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/admin/moderation")]
[Authorize(Policy = ApplicationPolicies.RequireAdmin)]
public sealed class AdminModerationController(IAdminModerationService moderation) : ControllerBase
{
    [HttpDelete("posts/{postId:guid}")]
    [ProducesResponseType(typeof(AdminActionResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<AdminActionResult>> DeletePost(Guid postId, [FromBody] DeleteContentRequest request, CancellationToken cancellationToken)
    {
        if (request is null) throw new Domain.Exceptions.ValidationException("A deletion reason is required.");
        return Ok(await moderation.DeletePostAsync(postId, request.Reason, cancellationToken));
    }

    [HttpDelete("offers/{offerId:guid}")]
    [ProducesResponseType(typeof(AdminActionResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<AdminActionResult>> DeleteOffer(Guid offerId, [FromBody] DeleteContentRequest request, CancellationToken cancellationToken)
    {
        if (request is null) throw new Domain.Exceptions.ValidationException("A deletion reason is required.");
        return Ok(await moderation.DeleteProfessionalOfferAsync(offerId, request.Reason, cancellationToken));
    }

    [HttpPost("users/{userId}/lock")]
    [ProducesResponseType(typeof(AccountLockStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<AccountLockStatusResponse>> LockAccount(string userId,
        [FromBody] CreateAccountLockRequest request, CancellationToken cancellationToken)
    {
        if (request is null) throw new Domain.Exceptions.ValidationException("An account lock duration is required.");
        return Ok(await moderation.LockAccountAsync(userId, request, cancellationToken));
    }

    [HttpDelete("users/{userId}/lock")]
    [ProducesResponseType(typeof(AccountLockStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AccountLockStatusResponse>> UnlockAccount(string userId, CancellationToken cancellationToken)
        => Ok(await moderation.UnlockAccountAsync(userId, cancellationToken));

    [HttpGet("users/{userId}/lock")]
    [ProducesResponseType(typeof(AccountLockStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AccountLockStatusResponse>> GetAccountLock(string userId, CancellationToken cancellationToken)
        => Ok(await moderation.GetAccountLockAsync(userId, cancellationToken));

    [HttpGet("locked/photographers")]
    [ProducesResponseType(typeof(PagedResult<AdminLockedAccountDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<AdminLockedAccountDto>>> GetLockedPhotographers(
        [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
        => Ok(await moderation.GetLockedAccountsAsync(Wesal.Domain.Constants.ApplicationRoles.Photographer,
            search, page, pageSize, cancellationToken));

    [HttpGet("locked/coordinators")]
    [ProducesResponseType(typeof(PagedResult<AdminLockedAccountDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<AdminLockedAccountDto>>> GetLockedCoordinators(
        [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
        => Ok(await moderation.GetLockedAccountsAsync(Wesal.Domain.Constants.ApplicationRoles.EventCoordinator,
            search, page, pageSize, cancellationToken));

    [HttpGet("posts")]
    [ProducesResponseType(typeof(PagedResult<AdminModeratedContentDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<AdminModeratedContentDto>>> ListPosts(
        [FromQuery] string? ownerId, [FromQuery] string? ownerRole, [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10, CancellationToken cancellationToken = default)
        => Ok(await moderation.ListAdminPostsAsync(ownerId, ownerRole, page, pageSize, cancellationToken));

    [HttpGet("posts/{postId:guid}")]
    [ProducesResponseType(typeof(AdminModeratedContentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminModeratedContentDto>> GetPost(Guid postId, CancellationToken cancellationToken)
        => Ok(await moderation.GetAdminPostAsync(postId, cancellationToken));

    [HttpGet("posts/{postId:guid}/images/{imageId:guid}")]
    public async Task<IActionResult> GetPostImage(Guid postId, Guid imageId, CancellationToken cancellationToken)
    {
        var document = await moderation.GetAdminPostImageAsync(postId, imageId, cancellationToken);
        return await Infrastructure.StoredDocumentResult.ServeAsync(document, cancellationToken, document.FileName);
    }

    [HttpGet("offers")]
    [ProducesResponseType(typeof(PagedResult<AdminModeratedContentDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<AdminModeratedContentDto>>> ListOffers(
        [FromQuery] string? ownerId, [FromQuery] string? ownerRole, [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10, CancellationToken cancellationToken = default)
        => Ok(await moderation.ListAdminOffersAsync(ownerId, ownerRole, page, pageSize, cancellationToken));

    [HttpGet("offers/{offerId:guid}")]
    [ProducesResponseType(typeof(AdminModeratedContentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminModeratedContentDto>> GetOffer(Guid offerId, CancellationToken cancellationToken)
        => Ok(await moderation.GetAdminOfferAsync(offerId, cancellationToken));

    [HttpGet("offers/{offerId:guid}/images/{imageId:guid}")]
    public async Task<IActionResult> GetOfferImage(Guid offerId, Guid imageId, CancellationToken cancellationToken)
    {
        var document = await moderation.GetAdminOfferImageAsync(offerId, imageId, cancellationToken);
        return await Infrastructure.StoredDocumentResult.ServeAsync(document, cancellationToken, document.FileName);
    }

}
