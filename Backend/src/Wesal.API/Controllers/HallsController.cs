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

    public HallsController(IFeaturedHallsService featuredHallsService)
    {
        _featuredHallsService = featuredHallsService;
    }

    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<FeaturedHallDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<IReadOnlyList<FeaturedHallDto>>> GetApprovedHalls(
        CancellationToken cancellationToken)
    {
        var halls = await _featuredHallsService.GetApprovedHallsAsync(cancellationToken);

        return Ok(halls);
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

    [HttpGet("search")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<FeaturedHallDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<ActionResult<IReadOnlyList<FeaturedHallDto>>> SearchHalls(
        [FromQuery] string? name,
        [FromQuery] HallRegion? region,
        [FromQuery] string? address,
        [FromQuery] DateOnly? date,
        [FromQuery] BookingPeriodType? period,
        CancellationToken cancellationToken)
    {
        if (region is not null && !Enum.IsDefined(region.Value))
        {
            ModelState.AddModelError(nameof(region), $"Region must be one of: {string.Join(", ", Enum.GetNames<HallRegion>())}.");

            return ValidationProblem();
        }

        if (period is not null && !Enum.IsDefined(period.Value))
        {
            ModelState.AddModelError(nameof(period), $"Period must be one of: {string.Join(", ", Enum.GetNames<BookingPeriodType>())}.");

            return ValidationProblem();
        }

        var halls = await _featuredHallsService.SearchHallsAsync(
            new HallSearchQuery
            {
                Name = name,
                Region = region,
                Address = address,
                Date = date,
                Period = period
            },
            cancellationToken);

        return Ok(halls);
    }
}
