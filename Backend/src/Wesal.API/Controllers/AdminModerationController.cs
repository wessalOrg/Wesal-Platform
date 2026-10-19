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

    [HttpPost("users/{userId}/publishing-restrictions")]
    [ProducesResponseType(typeof(PublishingRestrictionStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<PublishingRestrictionStatusResponse>> RestrictPublishing(string userId,
        [FromBody] CreatePublishingRestrictionRequest request, CancellationToken cancellationToken)
    {
        if (request is null) throw new Domain.Exceptions.ValidationException("A restriction duration is required.");
        return Ok(await moderation.RestrictPublishingAsync(userId, request, cancellationToken));
    }

    [HttpGet("users/{userId}/publishing-restriction")]
    [ProducesResponseType(typeof(PublishingRestrictionStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PublishingRestrictionStatusResponse>> GetRestriction(string userId, CancellationToken cancellationToken)
        => Ok(await moderation.GetRestrictionAsync(userId, cancellationToken));

    [HttpDelete("users/{userId}")]
    [ProducesResponseType(typeof(AdminActionResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<AdminActionResult>> DeleteAccount(string userId,
        [FromBody] DeleteAccountRequest request, CancellationToken cancellationToken)
    {
        if (request is null) throw new Domain.Exceptions.ValidationException("Explicit confirmation is required.");
        return Ok(await moderation.DeleteAccountAsync(userId, request, cancellationToken));
    }
}
