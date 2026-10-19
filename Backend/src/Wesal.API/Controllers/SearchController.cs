using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/search")]
[AllowAnonymous]
public sealed class SearchController(IDiscoverService discover) : ControllerBase
{
    /// <summary>Searches public hall names/areas, coordinator shop/store names, and photographer studio names.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<DiscoverItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<DiscoverItemDto>>> Get([FromQuery] string query, [FromQuery] string filter = "All",
        [FromQuery] int page = 1, [FromQuery] int pageSize = 10, CancellationToken cancellationToken = default)
        => Ok(await discover.SearchAsync(filter, query, page, pageSize, cancellationToken));
}
