using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/discover")]
[AllowAnonymous]
public sealed class DiscoverController(IDiscoverService discover) : ControllerBase
{
    /// <summary>Returns public discovery cards. Offers are a separate filter; All excludes offers.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<DiscoverItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<DiscoverItemDto>>> Get([FromQuery] string filter = "All", [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10, CancellationToken cancellationToken = default)
        => Ok(await discover.GetFeedAsync(filter, page, pageSize, cancellationToken));
}
