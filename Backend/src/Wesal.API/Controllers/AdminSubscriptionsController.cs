using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/admin/subscriptions")]
[Authorize(Policy = ApplicationPolicies.RequireAdmin)]
public class AdminSubscriptionsController : ControllerBase
{
    private readonly IAdminSubscriptionService _adminSubscriptionService;

    public AdminSubscriptionsController(IAdminSubscriptionService adminSubscriptionService)
    {
        _adminSubscriptionService = adminSubscriptionService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<AdminSubscriptionOwnerGroupDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IReadOnlyList<AdminSubscriptionOwnerGroupDto>>> GetSubscriptionOverview(
        [FromQuery] AdminSubscriptionOverviewQueryDto query,
        CancellationToken cancellationToken)
    {
        var response = await _adminSubscriptionService.GetSubscriptionOverviewAsync(query, cancellationToken);
        return Ok(response);
    }
}