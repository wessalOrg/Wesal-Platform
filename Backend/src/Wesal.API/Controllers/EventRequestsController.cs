using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Enums;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
public sealed class EventRequestsController(IEventRequestService service) : ControllerBase
{
    [HttpGet("api/v{version:apiVersion}/event-requests/configuration")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<EventTypeConfiguration>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<EventTypeConfiguration>>> GetConfiguration(CancellationToken ct)
        => Ok(await service.GetConfigurationAsync(ct));

    [HttpPost("api/v{version:apiVersion}/event-requests")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(EventRequestResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<EventRequestResponse>> Create([FromBody] EventRequestCreateRequest request, CancellationToken ct)
        => StatusCode(StatusCodes.Status201Created, await service.CreateAsync(request, ct));

    [HttpGet("api/v{version:apiVersion}/admin/event-requests")]
    [Authorize(Policy = ApplicationPolicies.RequireAdmin)]
    [ProducesResponseType(typeof(PagedResult<AdminEventRequestResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<AdminEventRequestResponse>>> GetAdmin([FromQuery] int page = 1,
        [FromQuery] int pageSize = 25, [FromQuery] DateOnly? from = null, [FromQuery] DateOnly? to = null,
        [FromQuery] string? eventType = null, [FromQuery] string? seekerId = null, CancellationToken ct = default)
    {
        if (!string.IsNullOrWhiteSpace(eventType) && !Enum.TryParse<EventType>(eventType, true, out _))
            return BadRequest(new ProblemDetails { Status = 400, Title = "Invalid event type." });
        return Ok(await service.GetAdminRequestsAsync(page, pageSize, from, to, eventType, seekerId, ct));
    }

    [HttpGet("api/v{version:apiVersion}/admin/event-requests/{id:guid}")]
    [Authorize(Policy = ApplicationPolicies.RequireAdmin)]
    [ProducesResponseType(typeof(AdminEventRequestResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminEventRequestResponse>> GetAdminById(Guid id, CancellationToken ct)
    {
        var result = await service.GetAdminRequestAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
    }
}
