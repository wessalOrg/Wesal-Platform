using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Enums;

namespace Wesal.API.Controllers;

/// <summary>
/// Administrator-only review of Photographer account requests (WESAL Task 6): the
/// status-filterable queue, the full submission detail (including the
/// administrator-only legal name and the ID document stream), the approve / reject /
/// request-changes decisions, and the Admin↔photographer conversation behind the
/// "contact photographer" action. The identity document is streamed from the private
/// store through this authenticated, admin-authorized endpoint; no public URL exists.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/admin/photographers")]
[Authorize(Policy = ApplicationPolicies.RequireAdmin)]
public class AdminPhotographersController : ControllerBase
{
    private readonly IPhotographerAdminService _photographerAdminService;

    public AdminPhotographersController(IPhotographerAdminService photographerAdminService)
    {
        _photographerAdminService = photographerAdminService;
    }

    /// <summary>
    /// The photographer account-request queue, newest submission first, optionally
    /// filtered by approval status (Task 6, requirement 6.1).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<AdminPhotographerRequestDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PagedResult<AdminPhotographerRequestDto>>> GetPhotographerRequests(
        [FromQuery] AccountApprovalStatus? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var response = await _photographerAdminService.GetPhotographerRequestsAsync(
            status, page, pageSize, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// The full setup submission: identity (including the administrator-only legal full
    /// name on the no-studio branch), every setup field, and the ID document endpoint
    /// (Task 6, requirement 6.2).
    /// </summary>
    [HttpGet("{userId}")]
    [ProducesResponseType(typeof(AdminPhotographerRequestDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminPhotographerRequestDetailDto>> GetPhotographerRequest(
        string userId,
        CancellationToken cancellationToken)
    {
        var response = await _photographerAdminService.GetPhotographerRequestDetailAsync(userId, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Streams a photographer's personal ID document, needed to verify the photographer
    /// before approving the account. Only the Admin can read it.
    /// </summary>
    [HttpGet("{userId}/identity-document")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPhotographerIdentityDocument(string userId, CancellationToken cancellationToken)
    {
        var document = await _photographerAdminService.GetPhotographerIdentityDocumentAsync(userId, cancellationToken);
        return await Infrastructure.StoredDocumentResult.ServeAsync(document, cancellationToken);
    }

    /// <summary>
    /// Approves the photographer's account (Task 6, requirement 6.3). 409 when the account
    /// is already approved.
    /// </summary>
    [HttpPost("{userId}/approve")]
    [ProducesResponseType(typeof(AdminAccountRequestDecisionResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<AdminAccountRequestDecisionResultDto>> ApprovePhotographerRequest(
        string userId,
        CancellationToken cancellationToken)
    {
        var response = await _photographerAdminService.ApprovePhotographerRequestAsync(userId, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Rejects the photographer's account with a mandatory reason (Task 6, requirement 6.4).
    /// The reason is delivered inside the rejection notification and posted into the Admin
    /// conversation, which the notification's action opens. 409 when already rejected.
    /// </summary>
    [HttpPost("{userId}/reject")]
    [ProducesResponseType(typeof(AdminAccountRequestDecisionResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<AdminAccountRequestDecisionResultDto>> RejectPhotographerRequest(
        string userId,
        AdminRejectAccountRequestDto request,
        CancellationToken cancellationToken)
    {
        var response = await _photographerAdminService.RejectPhotographerRequestAsync(userId, request, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Asks the photographer to edit their data or documents (Task 6, requirement 6.5):
    /// status becomes NeedsChanges, the mandatory notes are posted into the Admin
    /// conversation, and the "request needs editing" notification points at it.
    /// 409 when the account already needs changes.
    /// </summary>
    [HttpPost("{userId}/request-changes")]
    [ProducesResponseType(typeof(AdminAccountRequestDecisionResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<AdminAccountRequestDecisionResultDto>> RequestPhotographerChanges(
        string userId,
        AdminRequestChangesDto request,
        CancellationToken cancellationToken)
    {
        var response = await _photographerAdminService.RequestPhotographerChangesAsync(userId, request, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Resolves (creating on demand) the Admin↔photographer conversation for the
    /// "contact photographer" action (Task 6, requirement 6.6). Never posts a message.
    /// </summary>
    [HttpGet("{userId}/conversation")]
    [ProducesResponseType(typeof(AdminUserConversationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminUserConversationDto>> GetPhotographerConversation(
        string userId,
        CancellationToken cancellationToken)
    {
        var response = await _photographerAdminService.GetPhotographerConversationAsync(userId, cancellationToken);
        return Ok(response);
    }
}
