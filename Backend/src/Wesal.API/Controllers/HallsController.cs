using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/halls")]
public class HallsController : ControllerBase
{
    private readonly IFeaturedHallsService _featuredHallsService;

    public HallsController(IFeaturedHallsService featuredHallsService)
    {
        _featuredHallsService = featuredHallsService;
    }

    [HttpGet("featured")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<FeaturedHallDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<IReadOnlyList<FeaturedHallDto>>> GetFeaturedHalls(CancellationToken cancellationToken)
    {
        var halls = await _featuredHallsService.GetFeaturedHallsAsync(cancellationToken);

        return Ok(halls);
    }
}
