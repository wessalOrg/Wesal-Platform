using System.ComponentModel;
using ModelContextProtocol.Server;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;

namespace Wesal.API.Mcp;

/// <summary>
/// Read-only, guest-safe MCP tools for public Wesal hall discovery. The tool
/// methods are transport adapters only: all data and visibility rules remain in
/// the existing application services.
/// </summary>
[McpServerToolType]
public sealed class WesalHallMcpTools
{
    private const int MaxPageSize = 20;

    private readonly IHallSearchService _hallSearchService;
    private readonly IHallDetailsService _hallDetailsService;
    private readonly IHallAvailabilityService _hallAvailabilityService;
    private readonly ILogger<WesalHallMcpTools> _logger;

    public WesalHallMcpTools(
        IHallSearchService hallSearchService,
        IHallDetailsService hallDetailsService,
        IHallAvailabilityService hallAvailabilityService,
        ILogger<WesalHallMcpTools> logger)
    {
        _hallSearchService = hallSearchService;
        _hallDetailsService = hallDetailsService;
        _hallAvailabilityService = hallAvailabilityService;
        _logger = logger;
    }

    [McpServerTool(Name = "search_halls"), Description(
        "Searches publicly visible, approved Wesal halls. Use it to find halls by exact or partial name, Gaza region, area, date, and/or booking period. It returns only public search-listing data. Capacity is not supported by the current Wesal search service.")]
    public async Task<McpHallSearchResponse> SearchHallsAsync(
        [Description("Optional hall name, or part of a hall name.")] string? name = null,
        [Description("Optional Wesal region: NorthGaza, Gaza, MiddleArea, or SouthGaza.")] HallRegion? region = null,
        [Description("Optional area text within the selected region.")] string? area = null,
        [Description("Optional ISO-8601 date (YYYY-MM-DD) that must be available.")] DateOnly? date = null,
        [Description("Optional booking period: FirstPeriod or SecondPeriod.")] BookingPeriodType? bookingPeriod = null,
        [Description("Maximum number of halls to return, from 1 to 20. Defaults to 12.")] int pageSize = 12,
        CancellationToken cancellationToken = default)
    {
        if (pageSize is < 1 or > MaxPageSize)
        {
            throw new ArgumentOutOfRangeException(nameof(pageSize), $"pageSize must be between 1 and {MaxPageSize}.");
        }

        var response = await _hallSearchService.SearchHallsAsync(
            new HallSearchRequest
            {
                Name = Normalize(name, 120),
                Region = region,
                Area = Normalize(area, 80),
                Date = date,
                Period = bookingPeriod,
                PageNumber = 1,
                PageSize = pageSize
            },
            cancellationToken);

        _logger.LogInformation("MCP search_halls returned {Count} results.", response.Items.Count);
        return new McpHallSearchResponse(response.Items, response.TotalCount);
    }

    [McpServerTool(Name = "get_hall_details"), Description(
        "Gets public details for one approved Wesal hall by its hallId. Use a hallId returned by search_halls. It returns public listing information, photos, and the currently published availability window; it does not reveal private owner data.")]
    public async Task<McpHallDetailsResponse> GetHallDetailsAsync(
        [Description("The GUID hallId returned by search_halls.")] Guid hallId,
        CancellationToken cancellationToken = default)
    {
        var hall = await _hallDetailsService.GetHallDetailsAsync(hallId, cancellationToken);
        _logger.LogInformation("MCP get_hall_details completed for hall {HallId}.", hallId);

        return new McpHallDetailsResponse(
            hall.HallId,
            hall.HallName,
            hall.Region,
            hall.Address,
            hall.Description,
            hall.Capacity,
            hall.Price,
            hall.ContactPhone,
            hall.Photos,
            hall.Availability);
    }

    [McpServerTool(Name = "check_hall_availability"), Description(
        "Checks every configured booking period for one public, approved Wesal hall on one date. Use a hallId returned by search_halls and an ISO-8601 date. A returned Available status means that booking period has no current reservation; this tool does not create a booking.")]
    public async Task<HallAvailabilityDto> CheckHallAvailabilityAsync(
        [Description("The GUID hallId returned by search_halls.")] Guid hallId,
        [Description("ISO-8601 date (YYYY-MM-DD) to check.")] DateOnly date,
        CancellationToken cancellationToken = default)
    {
        var availability = await _hallAvailabilityService.GetHallAvailabilityAsync(hallId, date, cancellationToken);
        _logger.LogInformation("MCP check_hall_availability completed for hall {HallId} on {Date}.", hallId, date);
        return availability;
    }

    private static string? Normalize(string? value, int maxLength)
    {
        var normalized = value?.Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return null;
        }

        if (normalized.Length > maxLength)
        {
            throw new ArgumentException($"Input must not exceed {maxLength} characters.");
        }

        return normalized;
    }
}

public sealed record McpHallSearchResponse(IReadOnlyList<HallListItemDto> Halls, int TotalCount);

public sealed record McpHallDetailsResponse(
    Guid HallId,
    string HallName,
    string Region,
    string Address,
    string? Description,
    int Capacity,
    decimal? Price,
    string? ContactPhone,
    IReadOnlyList<HallImageDto> Photos,
    IReadOnlyList<HallAvailabilityDto> Availability);
