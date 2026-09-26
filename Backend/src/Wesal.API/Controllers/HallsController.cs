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
    private readonly IHourlySlotService _hourlySlotService;

    public HallsController(
        IFeaturedHallsService featuredHallsService,
        IHallDetailsService hallDetailsService,
        IAllHallsService allHallsService,
        IHallSearchService hallSearchService,
        IHourlySlotService hourlySlotService)
    {
        _featuredHallsService = featuredHallsService;
        _hallDetailsService = hallDetailsService;
        _allHallsService = allHallsService;
        _hallSearchService = hallSearchService;
        _hourlySlotService = hourlySlotService;
    }

    /// <summary>
    /// Public hall search (WESAL-TASK-7, Edit 7).
    ///
    /// All filters are optional and combine with AND. The location filters mirror the three
    /// fields an owner fills in when creating a hall, with their distinct roles preserved:
    /// <c>region</c> matches the Area (المنطقة) exactly, <c>area</c> partially matches the
    /// list-backed Address (العنوان), and <c>detailedAddress</c> partially matches the
    /// owner's free-text Detailed Address (العنوان التفصيلي). <c>area</c> deliberately does
    /// not fall back to DetailedAddress, so supplying an area keeps its exact shipped meaning.
    /// </summary>
    [HttpGet("search")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PagedResult<HallListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<HallListItemDto>>> SearchHalls(
        [FromQuery] string? name,
        [FromQuery] HallRegion? region,
        [FromQuery] string? area,
        [FromQuery] string? detailedAddress,
        [FromQuery] DateOnly? date,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 12,
        CancellationToken cancellationToken = default)
    {
        if (region is not null && !Enum.IsDefined(region.Value))
        {
            ModelState.AddModelError(nameof(region), $"Region must be one of: {string.Join(", ", Enum.GetNames<HallRegion>())}.");
            return ValidationProblem();
        }

        var request = new HallSearchRequest
        {
            Name = name,
            Region = region,
            Area = area,
            DetailedAddress = detailedAddress,
            Date = date,
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
    /// Returns the dependent Region → address lists used by the Add/Edit Hall flow
    /// (US-HALL). The owner first selects a region and then picks the hall's Address
    /// from that region's predefined list; the address is never free-text typed. The
    /// separate DetailedAddress field is the owner's own free-text detail and is
    /// therefore not served from this list.
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

    /// <summary>
    /// Returns the hourly-slot catalog for one hall on one date (WESAL-TASK-1, seeker
    /// flow): the day's 60-minute slots from the hall's hourly window, each marked
    /// Available or Booked. No slots are ever returned for a day the owner blocked. How
    /// that day is reported depends on the hall's ShowBookedSlots toggle: with it ON the
    /// response reports the day as not open; with it OFF the day is reported as open with
    /// an empty slot list, which is identical to a hidden fully-booked day, so the block
    /// is never disclosed. When the toggle is OFF, booked hours are likewise omitted from
    /// the response entirely; attempting to book one still returns an explicit conflict.
    /// </summary>
    [HttpGet("{id:guid}/hourly-catalog")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(HallHourlyCatalogDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<HallHourlyCatalogDto>> GetHourlyCatalog(
        Guid id,
        [FromQuery] DateOnly date,
        CancellationToken cancellationToken)
    {
        var catalog = await _hourlySlotService.GetHourlyCatalogAsync(id, date, cancellationToken);
        return Ok(catalog);
    }

    /// <summary>
    /// Returns the per-day open/closed availability calendar for one hall across a date
    /// range (WESAL-TASK-1, seeker flow). A day with no explicit gate defaults to open.
    /// A day the owner blocked is reported as closed only while the hall's ShowBookedSlots
    /// toggle is ON; with the toggle OFF a blocked day is deliberately indistinguishable
    /// from a hidden fully-booked day and reads as open, so the block is never leaked.
    /// </summary>
    [HttpGet("{id:guid}/availability-calendar")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(HallHourlyCalendarDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<HallHourlyCalendarDto>> GetAvailabilityCalendar(
        Guid id,
        [FromQuery] DateOnly fromDate,
        [FromQuery] DateOnly toDate,
        CancellationToken cancellationToken)
    {
        var calendar = await _hourlySlotService.GetAvailabilityCalendarAsync(id, fromDate, toDate, cancellationToken);
        return Ok(calendar);
    }

    /// <summary>
    /// Creates a booking request for a single hourly slot (WESAL-TASK-1, seeker flow).
    /// The slot is reserved atomically; a fully blocked day or an already-booked slot
    /// returns an explicit conflict (409) with a clear message rather than silently
    /// succeeding or failing.
    /// </summary>
    [HttpPost("{id:guid}/hourly-bookings")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(HourlyBookingResultDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<HourlyBookingResultDto>> CreateHourlyBooking(
        Guid id,
        [FromBody] HourlyBookingRequestDto request,
        CancellationToken cancellationToken)
    {
        // The route hall id is authoritative; the body may not redirect the booking to
        // a different hall.
        var hourlyRequest = new HourlyBookingRequestDto
        {
            HallId = id,
            Date = request.Date,
            SlotStarts = request.SlotStarts,
            NameOnBooking = request.NameOnBooking,
            RequesterName = request.RequesterName
        };

        var result = await _hourlySlotService.CreateHourlyBookingAsync(hourlyRequest, cancellationToken);
        return CreatedAtAction(nameof(CreateHourlyBooking), new { version = "1", id }, result);
    }
}
