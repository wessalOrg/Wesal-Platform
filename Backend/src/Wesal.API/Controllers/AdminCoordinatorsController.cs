using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Enums;

namespace Wesal.API.Controllers;

/// <summary>
/// Administrator-only review of Event Coordinator account requests (WESAL Task 5): the
/// status-filterable queue, the full submission detail with every image stream, the
/// approve/reject decisions, and the Admin↔coordinator conversation behind the
/// "contact coordinator" action. The document streams (identity, shop photo, work
/// photos) are served from the private store through these authenticated,
/// admin-authorized endpoints; no public URL exists for them.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/admin/coordinators")]
[Authorize(Policy = ApplicationPolicies.RequireAdmin)]
public class AdminCoordinatorsController : ControllerBase
{
    private readonly ICoordinatorAdminService _coordinatorAdminService;

    public AdminCoordinatorsController(ICoordinatorAdminService coordinatorAdminService)
    {
        _coordinatorAdminService = coordinatorAdminService;
    }

    /// <summary>
    /// The coordinator account-request queue, newest submission first, optionally
    /// filtered by approval status (Task 5, requirement 5.1).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<AdminCoordinatorRequestDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PagedResult<AdminCoordinatorRequestDto>>> GetCoordinatorRequests(
        [FromQuery] AccountApprovalStatus? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var response = await _coordinatorAdminService.GetCoordinatorRequestsAsync(
            status, page, pageSize, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// The full setup submission: identity, every setup field, and an endpoint per image
    /// (Task 5, requirement 5.2).
    /// </summary>
    [HttpGet("{userId}")]
    [ProducesResponseType(typeof(AdminCoordinatorRequestDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminCoordinatorRequestDetailDto>> GetCoordinatorRequest(
        string userId,
        CancellationToken cancellationToken)
    {
        var response = await _coordinatorAdminService.GetCoordinatorRequestDetailAsync(userId, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Streams a coordinator's personal ID document, needed to verify the coordinator
    /// before approving the account. Only the Admin can read it.
    /// </summary>
    [HttpGet("{userId}/identity-document")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCoordinatorIdentityDocument(string userId, CancellationToken cancellationToken)
    {
        var document = await _coordinatorAdminService.GetCoordinatorIdentityDocumentAsync(userId, cancellationToken);
        return await Infrastructure.StoredDocumentResult.ServeAsync(document, cancellationToken);
    }

    /// <summary>
    /// Streams the coordinator's shop photo (shop branch only). Only the Admin can read it.
    /// </summary>
    [HttpGet("{userId}/shop-photo")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCoordinatorShopPhoto(string userId, CancellationToken cancellationToken)
    {
        var document = await _coordinatorAdminService.GetCoordinatorShopPhotoAsync(userId, cancellationToken);
        return await Infrastructure.StoredDocumentResult.ServeAsync(document, cancellationToken);
    }

    /// <summary>
    /// Streams one of the coordinator's two work photos (freelance branch; index 1 or 2).
    /// Only the Admin can read it.
    /// </summary>
    [HttpGet("{userId}/work-photos/{index:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCoordinatorWorkPhoto(
        string userId,
        int index,
        CancellationToken cancellationToken)
    {
        var document = await _coordinatorAdminService.GetCoordinatorWorkPhotoAsync(userId, index, cancellationToken);
        return await Infrastructure.StoredDocumentResult.ServeAsync(document, cancellationToken);
    }

    /// <summary>
    /// Approves the coordinator's account (Task 5, requirement 5.3). 409 when the account
    /// is already approved.
    /// </summary>
    [HttpPost("{userId}/approve")]
    [ProducesResponseType(typeof(AdminAccountRequestDecisionResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<AdminAccountRequestDecisionResultDto>> ApproveCoordinatorRequest(
        string userId,
        CancellationToken cancellationToken)
    {
        var response = await _coordinatorAdminService.ApproveCoordinatorRequestAsync(userId, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Rejects the coordinator's account with a mandatory reason (Task 5, requirement 5.5).
    /// The reason is delivered inside the rejection notification and posted into the Admin
    /// conversation. 409 when the account is already rejected.
    /// </summary>
    [HttpPost("{userId}/reject")]
    [ProducesResponseType(typeof(AdminAccountRequestDecisionResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<AdminAccountRequestDecisionResultDto>> RejectCoordinatorRequest(
        string userId,
        AdminRejectAccountRequestDto request,
        CancellationToken cancellationToken)
    {
        var response = await _coordinatorAdminService.RejectCoordinatorRequestAsync(userId, request, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Resolves (creating on demand) the Admin↔coordinator conversation for the
    /// "contact coordinator" action (Task 5, requirement 5.6). Never posts a message.
    /// </summary>
    [HttpGet("{userId}/conversation")]
    [ProducesResponseType(typeof(AdminUserConversationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminUserConversationDto>> GetCoordinatorConversation(
        string userId,
        CancellationToken cancellationToken)
    {
        var response = await _coordinatorAdminService.GetCoordinatorConversationAsync(userId, cancellationToken);
        return Ok(response);
    }
}
