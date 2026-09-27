using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/admin/halls")]
[Authorize(Policy = ApplicationPolicies.RequireAdmin)]
public class AdminController : ControllerBase
{
    private readonly IAdminHallService _adminHallService;
    private readonly IAdminHallReviewService _adminHallReviewService;
    private readonly IAdminSubscriptionService _adminSubscriptionService;

    public AdminController(
        IAdminHallService adminHallService,
        IAdminHallReviewService adminHallReviewService,
        IAdminSubscriptionService adminSubscriptionService)
    {
        _adminHallService = adminHallService;
        _adminHallReviewService = adminHallReviewService;
        _adminSubscriptionService = adminSubscriptionService;
    }

    [HttpPut("{hallId:guid}/approve")]
    [ProducesResponseType(typeof(HallApprovalResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<HallApprovalResponse>> ApproveHall(Guid hallId, CancellationToken cancellationToken)
    {
        var response = await _adminHallService.ApproveHallAsync(hallId, cancellationToken);
        return Ok(response);
    }

    [HttpGet("pending")]
    [ProducesResponseType(typeof(PagedResult<AdminPendingHallDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PagedResult<AdminPendingHallDto>>> GetPendingHalls(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var response = await _adminHallReviewService.GetPendingHallsAsync(page, pageSize, cancellationToken);
        return Ok(response);
    }

    [HttpGet("{hallId:guid}")]
    [ProducesResponseType(typeof(AdminHallDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminHallDetailDto>> GetAdminHallDetail(
        Guid hallId,
        CancellationToken cancellationToken)
    {
        var response = await _adminHallReviewService.GetAdminHallDetailAsync(hallId, cancellationToken);
        return Ok(response);
    }

    [HttpPut("{hallId:guid}/reject")]
    [ProducesResponseType(typeof(AdminRejectHallResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<AdminRejectHallResultDto>> RejectHall(
        Guid hallId,
        AdminRejectHallRequestDto request,
        CancellationToken cancellationToken)
    {
        var response = await _adminHallReviewService.RejectHallAsync(hallId, request, cancellationToken);
        return Ok(response);
    }

    [HttpPut("{hallId:guid}/lock")]
    [ProducesResponseType(typeof(AdminLockHallResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminLockHallResultDto>> LockHall(
        Guid hallId,
        CancellationToken cancellationToken)
    {
        var response = await _adminHallReviewService.LockHallAsync(hallId, cancellationToken);
        return Ok(response);
    }

    [HttpPut("{hallId:guid}/unlock")]
    [ProducesResponseType(typeof(AdminUnlockHallResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminUnlockHallResultDto>> UnlockHall(
        Guid hallId,
        CancellationToken cancellationToken)
    {
        var response = await _adminHallReviewService.UnlockHallAsync(hallId, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Resolves this hall's owner/Admin conversation, creating it if none exists yet, WITHOUT
    /// sending a message (WESAL-TASK-10, Edit 15).
    ///
    /// This is what an Admin "Message" / "مراسلة" button calls. The existing
    /// <c>POST {hallId}/messages</c> is a send and requires non-empty content, so it cannot
    /// back a button whose only job is to open the thread; doing that through it would put a
    /// placeholder message in the owner's inbox.
    ///
    /// Resolution uses the same (HallId, HallOwnerId) key as Edit 4's payment notice and
    /// Edit 11's ContactAdmin, so this returns the thread that already exists rather than a
    /// second copy, and repeated calls always return the same id. Works for a hall in ANY
    /// status, including a locked one — an Admin must be able to open the conversation about a
    /// lock they applied. Admin-only via the controller's RequireAdmin policy.
    /// </summary>
    [HttpGet("{hallId:guid}/conversation")]
    [ProducesResponseType(typeof(AdminOwnerConversationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<AdminOwnerConversationDto>> GetOwnerConversation(
        Guid hallId,
        CancellationToken cancellationToken)
    {
        var response = await _adminHallReviewService.GetOwnerConversationAsync(hallId, cancellationToken);
        return Ok(response);
    }

    [HttpPost("{hallId:guid}/messages")]
    [ProducesResponseType(typeof(AdminOwnerMessageResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<AdminOwnerMessageResponseDto>> SendMessageToOwner(
        Guid hallId,
        AdminOwnerMessageRequestDto request,
        CancellationToken cancellationToken)
    {
        var response = await _adminHallReviewService.SendMessageToOwnerAsync(hallId, request.Content, cancellationToken);
        return Ok(response);
    }

    [HttpPut("{hallId:guid}/subscription/paid")]
    [ProducesResponseType(typeof(AdminMarkPaidResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<AdminMarkPaidResultDto>> MarkSubscriptionPaid(
        Guid hallId,
        CancellationToken cancellationToken)
    {
        var response = await _adminSubscriptionService.MarkSubscriptionPaidAsync(hallId, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Revokes a hall owner's subscription payment (WESAL-TASK-4, Edit 4). Sets the
    /// subscription to not-paid and clears the cycle, so the hall falls back behind the
    /// <c>PaymentRequired</c> management gate and the owner sees no days remaining.
    ///
    /// A direct administrative action: it does not require, inspect, or depend on any
    /// payment-proof message having been sent. The target is the hall named in the route,
    /// and the controller requires the Admin role, so an owner or seeker calling this is
    /// rejected with 403 before the service runs.
    /// </summary>
    [HttpPut("{hallId:guid}/subscription/unpaid")]
    [ProducesResponseType(typeof(AdminMarkPaidResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminMarkPaidResultDto>> MarkSubscriptionNotPaid(
        Guid hallId,
        CancellationToken cancellationToken)
    {
        var response = await _adminSubscriptionService.MarkSubscriptionNotPaidAsync(hallId, cancellationToken);
        return Ok(response);
    }

    [HttpDelete("{hallId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteHall(Guid hallId, CancellationToken cancellationToken)
    {
        await _adminHallService.DeleteHallAsync(hallId, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Streams a Hall Owner's identity document, needed to verify the owner before
    /// payment confirmation (US-ADMIN-07). Only the Admin can read it.
    /// </summary>
    [HttpGet("owners/{ownerId}/identity-document")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetOwnerIdentityDocument(string ownerId, CancellationToken cancellationToken)
    {
        var document = await _adminHallReviewService.GetOwnerIdentityDocumentAsync(ownerId, cancellationToken);
        return await Infrastructure.StoredDocumentResult.ServeAsync(
            document.FullPath, document.ContentType, cancellationToken);
    }
}