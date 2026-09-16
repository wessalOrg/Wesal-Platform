using Microsoft.Extensions.Logging.Abstractions;
using ModelContextProtocol.Server;
using Wesal.API.Mcp;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;

namespace Wesal.Tests.Api;

public sealed class WesalHallMcpToolsShould
{
    private readonly FakeHallSearchService _search = new();
    private readonly FakeHallDetailsService _details = new();
    private readonly FakeHallAvailabilityService _availability = new();

    private WesalHallMcpTools CreateTools() => new(
        _search,
        _details,
        _availability,
        NullLogger<WesalHallMcpTools>.Instance);

    [Fact]
    public void DeclareExactlyTheThreeGuestSafeMcpToolsForDiscovery()
    {
        var tools = typeof(WesalHallMcpTools)
            .GetMethods()
            .Select(method => new
            {
                Attribute = method.GetCustomAttributes(typeof(McpServerToolAttribute), inherit: false)
                    .Cast<McpServerToolAttribute>()
                    .SingleOrDefault(),
                Description = method.GetCustomAttributes(typeof(System.ComponentModel.DescriptionAttribute), inherit: false)
                    .Cast<System.ComponentModel.DescriptionAttribute>()
                    .SingleOrDefault()?.Description
            })
            .Where(item => item.Attribute is not null)
            .ToList();

        Assert.Equal(["check_hall_availability", "get_hall_details", "search_halls"],
            tools.Select(tool => tool.Attribute!.Name).OrderBy(name => name));
        Assert.All(tools, tool => Assert.False(string.IsNullOrWhiteSpace(tool.Description)));
    }

    [Fact]
    public async Task SearchPublicHallsThroughExistingSearchService()
    {
        var hall = new HallListItemDto { HallId = Guid.NewGuid(), HallName = "Gaza Hall" };
        _search.Response = PagedResult<HallListItemDto>.Create([hall], 1, 12, 1);

        var result = await CreateTools().SearchHallsAsync(region: HallRegion.Gaza);

        Assert.Equal(HallRegion.Gaza, _search.Request!.Region);
        Assert.Single(result.Halls);
        Assert.Equal(hall.HallId, result.Halls[0].HallId);
    }

    [Fact]
    public async Task RejectInvalidSearchPageSizeBeforeCallingService()
    {
        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(
            () => CreateTools().SearchHallsAsync(pageSize: 21));

        Assert.Null(_search.Request);
    }

    [Fact]
    public async Task ReturnAvailabilityFromSharedApplicationService()
    {
        var hallId = Guid.NewGuid();
        var date = new DateOnly(2026, 12, 4);
        _availability.Response = new HallAvailabilityDto
        {
            Date = date,
            Periods =
            [
                new HallBookingPeriodStatusDto
                {
                    PeriodType = BookingPeriodType.SecondPeriod,
                    PeriodName = "Second Period",
                    Status = AvailabilityStatus.Booked
                }
            ]
        };

        var result = await CreateTools().CheckHallAvailabilityAsync(hallId, date);

        Assert.Equal(hallId, _availability.HallId);
        Assert.Equal(date, result.Date);
        Assert.Equal(AvailabilityStatus.Booked, Assert.Single(result.Periods).Status);
    }

    private sealed class FakeHallSearchService : IHallSearchService
    {
        public HallSearchRequest? Request { get; private set; }
        public PagedResult<HallListItemDto> Response { get; set; } = PagedResult<HallListItemDto>.Create([], 1, 12, 0);

        public Task<PagedResult<HallListItemDto>> SearchHallsAsync(HallSearchRequest request, CancellationToken cancellationToken = default)
        {
            Request = request;
            return Task.FromResult(Response);
        }
    }

    private sealed class FakeHallDetailsService : IHallDetailsService
    {
        public Task<HallDetailsDto> GetHallDetailsAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult(new HallDetailsDto { HallId = hallId, HallName = "Gaza Hall" });
    }

    private sealed class FakeHallAvailabilityService : IHallAvailabilityService
    {
        public Guid HallId { get; private set; }
        public HallAvailabilityDto Response { get; set; } = new();

        public Task<HallAvailabilityDto> GetHallAvailabilityAsync(Guid hallId, DateOnly date, CancellationToken cancellationToken = default)
        {
            HallId = hallId;
            return Task.FromResult(Response);
        }
    }
}
