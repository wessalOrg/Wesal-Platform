using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.AiAssistant;
using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

public sealed class WesalToolGatewayShould
{
    private readonly FakeSearchService _search = new();
    private readonly FakeDetailsService _details = new();
    private readonly FakeHourlySlotService _availability = new();
    private readonly WesalToolGateway _gateway;

    public WesalToolGatewayShould()
    {
        _gateway = new WesalToolGateway(
            _search,
            _details,
            _availability,
            NullLogger<WesalToolGateway>.Instance);
    }

    [Fact]
    public void ExposeExactlyThreeToolDefinitions()
    {
        var names = _gateway.ToolDefinitions.Select(d => d.Name).OrderBy(x => x).ToList();

        Assert.Equal(
            [WesalToolNames.CheckHallAvailability, WesalToolNames.GetHallDetails, WesalToolNames.SearchHalls],
            names);
    }

    [Fact]
    public void EveryDefinitionHaveNonEmptyDescriptionAndSchema()
    {
        foreach (var definition in _gateway.ToolDefinitions)
        {
            Assert.False(string.IsNullOrWhiteSpace(definition.Description));
            Assert.NotNull(definition.Parameters);
            Assert.Equal("object", definition.Parameters["type"]?.GetValue<string>());
        }
    }

    [Fact]
    public void IsKnownTool_OnlyAcceptsApprovedNames()
    {
        Assert.True(_gateway.IsKnownTool(WesalToolNames.SearchHalls));
        Assert.True(_gateway.IsKnownTool(WesalToolNames.GetHallDetails));
        Assert.True(_gateway.IsKnownTool(WesalToolNames.CheckHallAvailability));
        Assert.False(_gateway.IsKnownTool("get_my_bookings"));
        Assert.False(_gateway.IsKnownTool(""));
        Assert.False(_gateway.IsKnownTool("search_halls ") );
    }

    [Fact]
    public void RejectInvocationWithUnknownToolName()
    {
        var invocation = new WesalToolInvocation("get_my_bookings", []);
        var result = _gateway.ExecuteAsync(invocation).GetAwaiter().GetResult();

        Assert.False(result.Success);
        Assert.Contains("not a supported", result.ErrorMessage);
    }

    [Fact]
    public void RejectInvocationCarryingJwtToken()
    {
        var invocation = new WesalToolInvocation(
            WesalToolNames.SearchHalls,
            new JsonObject { ["token"] = "fake-jwt" });

        var result = _gateway.ExecuteAsync(invocation).GetAwaiter().GetResult();

        Assert.False(result.Success);
        Assert.Contains("authentication material", result.ErrorMessage);
    }

    [Fact]
    public void RejectInvocationCarryingUserId()
    {
        var invocation = new WesalToolInvocation(
            WesalToolNames.SearchHalls,
            new JsonObject { ["userId"] = "user-123" });

        var result = _gateway.ExecuteAsync(invocation).GetAwaiter().GetResult();

        Assert.False(result.Success);
    }

    [Fact]
    public void RejectInvocationCarryingClaims()
    {
        var invocation = new WesalToolInvocation(
            WesalToolNames.GetHallDetails,
            new JsonObject { ["claims"] = "admin" });

        var result = _gateway.ExecuteAsync(invocation).GetAwaiter().GetResult();

        Assert.False(result.Success);
        Assert.Contains("authentication material", result.ErrorMessage);
    }

    [Fact]
    public void RejectUnknownArgumentKey()
    {
        var invocation = new WesalToolInvocation(
            WesalToolNames.GetHallDetails,
            new JsonObject
            {
                ["hallId"] = Guid.NewGuid().ToString(),
                ["extraField"] = "nope"
            });

        var result = _gateway.ExecuteAsync(invocation).GetAwaiter().GetResult();

        Assert.False(result.Success);
        Assert.Contains("does not accept", result.ErrorMessage);
        Assert.Contains("extraField", result.ErrorMessage);
    }

    [Fact]
    public void SearchRejectsEmptyCriteriaSet()
    {
        var invocation = new WesalToolInvocation(WesalToolNames.SearchHalls, new JsonObject());

        var result = _gateway.ExecuteAsync(invocation).GetAwaiter().GetResult();

        Assert.False(result.Success);
        Assert.Contains("at least one search criterion", result.ErrorMessage);
    }

    [Fact]
    public void SearchRejectsBadPageSize()
    {
        var invocation = new WesalToolInvocation(
            WesalToolNames.SearchHalls,
            new JsonObject
            {
                ["region"] = "Gaza",
                ["pageSize"] = 50
            });

        var result = _gateway.ExecuteAsync(invocation).GetAwaiter().GetResult();

        Assert.False(result.Success);
        Assert.Contains("pageSize", result.ErrorMessage);
    }

    [Fact]
    public void SearchRejectsInvalidRegion()
    {
        var invocation = new WesalToolInvocation(
            WesalToolNames.SearchHalls,
            new JsonObject
            {
                ["region"] = "InvalidRegion"
            });

        var result = _gateway.ExecuteAsync(invocation).GetAwaiter().GetResult();

        Assert.False(result.Success);
        Assert.Contains("region", result.ErrorMessage);
    }

    [Fact]
    public void SearchRejectsInvalidDate()
    {
        var invocation = new WesalToolInvocation(
            WesalToolNames.SearchHalls,
            new JsonObject
            {
                ["date"] = "not-a-date"
            });

        var result = _gateway.ExecuteAsync(invocation).GetAwaiter().GetResult();

        Assert.False(result.Success);
        Assert.Contains("date", result.ErrorMessage);
    }

    [Fact]
    public void SearchRejectsUnknownBookingPeriodArgument()
    {
        var invocation = new WesalToolInvocation(
            WesalToolNames.SearchHalls,
            new JsonObject
            {
                ["bookingPeriod"] = "MidDay"
            });

        var result = _gateway.ExecuteAsync(invocation).GetAwaiter().GetResult();

        Assert.False(result.Success);
        Assert.Contains("bookingPeriod", result.ErrorMessage);
    }

    [Fact]
    public async Task SearchDelegatesToSearchService()
    {
        var hallId = Guid.NewGuid();
        _search.Response = PagedResult<HallListItemDto>.Create(
            [new HallListItemDto { HallId = hallId, HallName = "Gaza Hall", Region = "Gaza" }],
            1, 12, 1);

        var invocation = new WesalToolInvocation(
            WesalToolNames.SearchHalls,
            new JsonObject
            {
                ["region"] = "Gaza",
                ["pageSize"] = 10
            });

        var result = await _gateway.ExecuteAsync(invocation);

        Assert.True(result.Success);
        Assert.NotNull(result.Data);
        Assert.Equal(HallRegion.Gaza, _search.LastRequest!.Region);
        Assert.Equal(10, _search.LastRequest.PageSize);
        Assert.NotNull(result.Data!["halls"]);
    }

    [Fact]
    public async Task SearchDefaultPageSizeIs12()
    {
        _search.Response = PagedResult<HallListItemDto>.Create([], 1, 12, 0);

        var invocation = new WesalToolInvocation(
            WesalToolNames.SearchHalls,
            new JsonObject { ["name"] = "Gaza Hall" });

        var result = await _gateway.ExecuteAsync(invocation);

        Assert.True(result.Success);
        Assert.Equal(12, _search.LastRequest!.PageSize);
    }

    [Fact]
    public void GetHallDetailsRejectsMissingHallId()
    {
        var invocation = new WesalToolInvocation(
            WesalToolNames.GetHallDetails,
            new JsonObject());

        var result = _gateway.ExecuteAsync(invocation).GetAwaiter().GetResult();

        Assert.False(result.Success);
        Assert.Contains("hallId", result.ErrorMessage);
    }

    [Fact]
    public void GetHallDetailsRejectsInvalidGuid()
    {
        var invocation = new WesalToolInvocation(
            WesalToolNames.GetHallDetails,
            new JsonObject { ["hallId"] = "not-a-guid" });

        var result = _gateway.ExecuteAsync(invocation).GetAwaiter().GetResult();

        Assert.False(result.Success);
        Assert.Contains("hallId", result.ErrorMessage);
    }

    [Fact]
    public async Task GetHallDetailsPayloadExcludesStatusAndIsOwner()
    {
        var hallId = Guid.NewGuid();
        _details.Response = new HallDetailsDto
        {
            HallId = hallId,
            HallName = "Gaza Hall",
            Status = HallStatus.Approved,
            IsOwner = true,
            Photos = [new HallImageDto { Id = Guid.NewGuid(), Url = "http://img" }],
            Availability = [new HallAvailabilityDto { Date = new DateOnly(2026, 12, 1) }]
        };

        var invocation = new WesalToolInvocation(
            WesalToolNames.GetHallDetails,
            new JsonObject { ["hallId"] = hallId.ToString() });

        var result = await _gateway.ExecuteAsync(invocation);

        Assert.True(result.Success);
        Assert.NotNull(result.Data);
        var hall = result.Data!["hall"];
        Assert.NotNull(hall);
        Assert.Equal(hallId.ToString(), hall!["hallId"]?.GetValue<string>());
        Assert.Null(hall!["status"]);
        Assert.Null(hall!["isOwner"]);
    }

    [Fact]
    public async Task GetHallDetailsIncludesContactPhoneAndPhotos()
    {
        var hallId = Guid.NewGuid();
        _details.Response = new HallDetailsDto
        {
            HallId = hallId,
            ContactPhone = "0591234567",
            Photos = [new HallImageDto { Id = Guid.NewGuid(), Url = "http://img" }]
        };

        var invocation = new WesalToolInvocation(
            WesalToolNames.GetHallDetails,
            new JsonObject { ["hallId"] = hallId.ToString() });

        var result = await _gateway.ExecuteAsync(invocation);

        var hall = result.Data!["hall"];
        Assert.Equal("0591234567", hall!["contactPhone"]?.GetValue<string>());
        Assert.NotNull(hall!["photos"]);
    }

    [Fact]
    public async Task GetHallDetailsNormalizesNotFoundException()
    {
        _details.ThrowNotFound = true;

        var invocation = new WesalToolInvocation(
            WesalToolNames.GetHallDetails,
            new JsonObject { ["hallId"] = Guid.NewGuid().ToString() });

        var result = await _gateway.ExecuteAsync(invocation);

        Assert.False(result.Success);
        Assert.Contains("not found", result.ErrorMessage);
    }

    [Fact]
    public void CheckAvailabilityRejectsMissingDate()
    {
        var invocation = new WesalToolInvocation(
            WesalToolNames.CheckHallAvailability,
            new JsonObject { ["hallId"] = Guid.NewGuid().ToString() });

        var result = _gateway.ExecuteAsync(invocation).GetAwaiter().GetResult();

        Assert.False(result.Success);
        Assert.Contains("date", result.ErrorMessage);
    }

    [Fact]
    public async Task CheckAvailabilityDelegatesToAvailabilityService()
    {
        var hallId = Guid.NewGuid();
        var date = new DateOnly(2026, 12, 1);
        _availability.Response = new HallHourlyCatalogDto
        {
            HallId = hallId,
            Date = date,
            DayOpen = true,
            Slots =
            [
                new HallHourlySlotDto { StartTime = new TimeOnly(10, 0), EndTime = new TimeOnly(11, 0), Status = HallSlotStatus.Available },
                new HallHourlySlotDto { StartTime = new TimeOnly(11, 0), EndTime = new TimeOnly(12, 0), Status = HallSlotStatus.Booked }
            ]
        };

        var invocation = new WesalToolInvocation(
            WesalToolNames.CheckHallAvailability,
            new JsonObject
            {
                ["hallId"] = hallId.ToString(),
                ["date"] = "2026-12-01"
            });

        var result = await _gateway.ExecuteAsync(invocation);

        Assert.True(result.Success);
        Assert.Equal(hallId, _availability.LastHallId);
        Assert.Equal(date, _availability.LastDate);
        Assert.Equal(2, result.Data!["slots"]!.AsArray().Count);
    }

    [Fact]
    public async Task NormalizeUnexpectedExceptionIntoUserSafeError()
    {
        _search.ThrowUnexpected = true;

        var invocation = new WesalToolInvocation(
            WesalToolNames.SearchHalls,
            new JsonObject { ["name"] = "Gaza Hall" });

        var result = await _gateway.ExecuteAsync(invocation);

        Assert.False(result.Success);
        Assert.Contains("could not complete", result.ErrorMessage);
    }

    private sealed class FakeSearchService : IHallSearchService
    {
        public HallSearchRequest? LastRequest { get; private set; }
        public PagedResult<HallListItemDto> Response { get; set; }
            = PagedResult<HallListItemDto>.Create([], 1, 12, 0);
        public bool ThrowNotFound { get; set; }
        public bool ThrowUnexpected { get; set; }

        public Task<PagedResult<HallListItemDto>> SearchHallsAsync(HallSearchRequest request, CancellationToken cancellationToken = default)
        {
            LastRequest = request;
            if (ThrowUnexpected) throw new InvalidOperationException("boom");
            return Task.FromResult(Response);
        }
    }

    private sealed class FakeDetailsService : IHallDetailsService
    {
        public HallDetailsDto Response { get; set; } = new();
        public bool ThrowNotFound { get; set; }

        public Task<HallDetailsDto> GetHallDetailsAsync(Guid hallId, CancellationToken cancellationToken = default)
        {
            if (ThrowNotFound)
                throw new Wesal.Domain.Exceptions.NotFoundException(nameof(HallDetailsDto), hallId);
            Response = new HallDetailsDto
            {
                HallId = hallId,
                HallName = Response.HallName,
                Status = Response.Status,
                IsOwner = Response.IsOwner,
                ContactPhone = Response.ContactPhone,
                Photos = Response.Photos,
                Availability = Response.Availability
            };
            return Task.FromResult(Response);
        }
    }
}