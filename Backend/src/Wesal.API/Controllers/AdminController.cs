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
}