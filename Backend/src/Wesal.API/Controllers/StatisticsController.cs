using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/statistics")]
[Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
public sealed class StatisticsController(IStatisticsService statistics) : ControllerBase
{
    /// <summary>Returns only the authenticated coordinator or photographer's engagement statistics.</summary>
    /// <remarks>View counts are total successful public detail requests, not unique viewers. Repeated requests count separately.</remarks>
    [EndpointSummary("Get professional account statistics")]
    [EndpointDescription("Post and profile views count each successful public detail request. Repeated requests count separately; these are not unique-viewer counts.")]
    [HttpGet("me")]
    [ProducesResponseType(typeof(OwnerStatisticsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<OwnerStatisticsDto>> GetMine([FromQuery] int page = 1, [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
        => Ok(await statistics.GetMyStatisticsAsync(page, pageSize, cancellationToken));
}
