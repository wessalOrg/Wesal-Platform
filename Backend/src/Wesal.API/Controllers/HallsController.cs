using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/halls")]
public class HallsController : ControllerBase
{
    private readonly IFeaturedHallsService _featuredHallsService;
    private readonly IHallDetailsService _hallDetailsService;

    public HallsController(
        IFeaturedHallsService featuredHallsService,
        IHallDetailsService hallDetailsService)
    {
        _featuredHallsService = featuredHallsService;
        _hallDetailsService = hallDetailsService;
    }

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(HallDetailsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<HallDetailsDto>> GetHallDetails(
        Guid id,
        CancellationToken cancellationToken)
    {
        var hall = await _hallDetailsService.GetHallDetailsAsync(id, cancellationToken);

        return Ok(hall);
    }

    [HttpGet("featured")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<FeaturedHallDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<IReadOnlyList<FeaturedHallDto>>> GetFeaturedHalls(
        [FromQuery] HallRegion? region,
        CancellationToken cancellationToken)
    {
        if (region is not null && !Enum.IsDefined(region.Value))
        {
            ModelState.AddModelError(nameof(region), $"Region must be one of: {string.Join(", ", Enum.GetNames<HallRegion>())}.");

            return ValidationProblem();
        }

        var halls = await _featuredHallsService.GetFeaturedHallsAsync(region, cancellationToken);

        return Ok(halls);
    }
}
