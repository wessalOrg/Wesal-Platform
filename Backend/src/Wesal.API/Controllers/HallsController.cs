using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Catalogs;
using Wesal.Domain.Constants;
using Wesal.Domain.Enums;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/halls")]
public class HallsController : ControllerBase
{
    private readonly IFeaturedHallsService _featuredHallsService;
    private readonly IHallDetailsService _hallDetailsService;
    private readonly IAllHallsService _allHallsService;
    private readonly IHallSearchService _hallSearchService;

    public HallsController(
        IFeaturedHallsService featuredHallsService,
        IHallDetailsService hallDetailsService,
        IAllHallsService allHallsService,
        IHallSearchService hallSearchService)
    {
        _featuredHallsService = featuredHallsService;
        _hallDetailsService = hallDetailsService;
        _allHallsService = allHallsService;
        _hallSearchService = hallSearchService;
    }

    [HttpGet("search")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PagedResult<HallListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<HallListItemDto>>> SearchHalls(
        [FromQuery] string? name,
        [FromQuery] HallRegion? region,
        [FromQuery] string? area,
        [FromQuery] DateOnly? date,
        [FromQuery] BookingPeriodType? period,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 12,
        CancellationToken cancellationToken = default)
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

        var request = new HallSearchRequest
        {
            Name = name,
            Region = region,
            Area = area,
            Date = date,
            Period = period,
            PageNumber = pageNumber,
            PageSize = pageSize
        };

        var result = await _hallSearchService.SearchHallsAsync(request, cancellationToken);
        return Ok(result);
    }

    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PagedResult<HallListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<HallListItemDto>>> GetHalls(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 12,
        CancellationToken cancellationToken = default)
    {
        var result = await _allHallsService.GetApprovedHallsAsync(pageNumber, pageSize, cancellationToken);
        return Ok(result);
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

        try
        {
            var halls = await _featuredHallsService.GetFeaturedHallsAsync(region, cancellationToken);
            return Ok(halls);
        }
        catch (OperationCanceledException)
        {
            return Ok(Array.Empty<FeaturedHallDto>());
        }
    }

    /// <summary>
    /// Returns the dependent Region → detailed-address lists used by the Add/Edit Hall
    /// flow (US-HALL). The owner first selects a region and then picks a detailed address
    /// from that region's predefined list; the detailed address is never free-text typed.
    /// </summary>
    [HttpGet("catalog/addresses")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(IReadOnlyList<RegionAddressCatalogDto>), StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyList<RegionAddressCatalogDto>> GetRegionAddressCatalog()
    {
        return Ok(Enum.GetValues<HallRegion>().Select(region => new RegionAddressCatalogDto
        {
            Region = region,
            RegionDisplayName = region.ToString(),
            Addresses = RegionAddressCatalog.GetAddresses(region)
        }).ToList());
    }

    /// <summary>
    /// Returns the predefined hall features with their canonical Arabic names used by the
    /// Add/Edit Hall flow (US-HALL).
    /// </summary>
    [HttpGet("catalog/features")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(HallFeatureCatalogDto), StatusCodes.Status200OK)]
    public ActionResult<HallFeatureCatalogDto> GetFeatureCatalog()
    {
        return Ok(new HallFeatureCatalogDto
        {
            Features = HallFeatureCatalog.PredefinedFeatures
        });
    }
}
