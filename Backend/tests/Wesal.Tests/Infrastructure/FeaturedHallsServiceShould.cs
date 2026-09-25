using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.Halls;
using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

public class FeaturedHallsServiceShould
{
    private static readonly DateTimeOffset FixedNow = new(2026, 8, 6, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task GetFeaturedHallsAsync_ReturnsUpToSixHalls()
    {
        var fakeRepository = new FakeHallRepository();
        for (var index = 0; index < 8; index++)
        {
            fakeRepository.Halls.Add(CreateHall(name: $"Hall {index}", createdAt: FixedNow.AddDays(-index)));
        }

        var result = await CreateService(fakeRepository).GetFeaturedHallsAsync();

        Assert.Equal(6, result.Count);
    }

    [Fact]
    public async Task GetFeaturedHallsAsync_ReturnsEmptyListWhenNoHallsExist()
    {
        var result = await CreateService(new FakeHallRepository()).GetFeaturedHallsAsync();

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetFeaturedHallsAsync_MapsHallInformation()
    {
        var hall = CreateHall(
            name: "Al-Nasr Hall",
            createdAt: FixedNow,
            region: HallRegion.Gaza,
            address: "Al-Nasr Street, Gaza",
            capacity: 300,
            price: 2500m,
            description: "Spacious hall in the heart of Gaza.");
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var featured = Assert.Single(await CreateService(fakeRepository).GetFeaturedHallsAsync());

        Assert.Equal(hall.Id, featured.HallId);
        Assert.Equal("Al-Nasr Hall", featured.HallName);
        Assert.Equal("Gaza", featured.Region);
        Assert.Equal("Al-Nasr Street, Gaza", featured.Address);
        Assert.Equal(300, featured.Capacity);
        Assert.Equal(2500m, featured.Price);
        Assert.Equal("Spacious hall in the heart of Gaza.", featured.ShortDescription);
    }

    [Fact]
    public async Task GetFeaturedHallsAsync_HidesPriceWhenShowPriceIsFalse()
    {
        var hall = CreateHall(name: "Hidden Price Hall", createdAt: FixedNow, price: 2000m);
        hall.ShowPrice = false;
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var featured = Assert.Single(await CreateService(fakeRepository).GetFeaturedHallsAsync());

        Assert.Null(featured.Price);
    }

    [Fact]
    public async Task GetFeaturedHallsAsync_ExposesHourlySlotsForEachDay()
    {
        var hall = CreateHall(name: "Hourly Hall", createdAt: FixedNow);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var featured = Assert.Single(await CreateService(fakeRepository).GetFeaturedHallsAsync());

        Assert.Equal(FeaturedHallsService.AvailabilityDays, featured.Availability.Count);
        Assert.All(featured.Availability, day => Assert.Equal(3, day.Slots.Count));
        Assert.All(featured.Availability, day => Assert.Equal(new TimeOnly(9, 0), day.Slots[0].StartTime));
    }

    [Fact]
    public async Task GetFeaturedHallsAsync_ResolvesHourlySlotStatusFromCatalog()
    {
        var hall = CreateHall(name: "Availability Hall", createdAt: FixedNow);
        var firstDay = DateOnly.FromDateTime(FixedNow.UtcDateTime);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);
        var hourly = new FakeHourlySlotService();
        hourly.Catalogs[firstDay] = new HallHourlyCatalogDto
        {
            HallId = hall.Id,
            Date = firstDay,
            DayOpen = true,
            Slots =
            [
                new HallHourlySlotDto
                {
                    StartTime = new TimeOnly(9, 0),
                    EndTime = new TimeOnly(10, 0),
                    Status = HallSlotStatus.Booked
                },
                new HallHourlySlotDto
                {
                    StartTime = new TimeOnly(10, 0),
                    EndTime = new TimeOnly(11, 0),
                    Status = HallSlotStatus.Available
                }
            ]
        };

        var featured = Assert.Single(await CreateService(fakeRepository, hourly).GetFeaturedHallsAsync());
        var day = featured.Availability.Single(item => item.Date == firstDay);

        Assert.Equal(HallSlotStatus.Booked, day.Slots[0].Status);
        Assert.Equal(HallSlotStatus.Available, day.Slots[1].Status);
    }

    [Fact]
    public async Task GetFeaturedHallsAsync_DefaultsUnrecordedSlotsToAvailable()
    {
        var hall = CreateHall(name: "No Availability Hall", createdAt: FixedNow);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var featured = Assert.Single(await CreateService(fakeRepository).GetFeaturedHallsAsync());

        Assert.All(featured.Availability, day =>
            Assert.All(day.Slots, slot => Assert.Equal(HallSlotStatus.Available, slot.Status)));
    }

    [Fact]
    public async Task GetFeaturedHallsAsync_WithRegion_FiltersHallsByRegion()
    {
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(CreateHall(name: "North 1", createdAt: FixedNow, region: HallRegion.NorthGaza));
        fakeRepository.Halls.Add(CreateHall(name: "Gaza 1", createdAt: FixedNow.AddDays(-1), region: HallRegion.Gaza));
        fakeRepository.Halls.Add(CreateHall(name: "Gaza 2", createdAt: FixedNow.AddDays(-2), region: HallRegion.Gaza));
        fakeRepository.Halls.Add(CreateHall(name: "South 1", createdAt: FixedNow.AddDays(-3), region: HallRegion.SouthGaza));

        var result = await CreateService(fakeRepository).GetFeaturedHallsAsync(HallRegion.Gaza);

        Assert.Collection(
            result,
            featured => Assert.Equal("Gaza 1", featured.HallName),
            featured => Assert.Equal("Gaza 2", featured.HallName));
        Assert.All(result, featured => Assert.Equal("Gaza", featured.Region));
    }

    [Fact]
    public async Task GetFeaturedHallsAsync_WithRegion_ReturnsEmptyWhenRegionHasNoHalls()
    {
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(CreateHall(name: "Gaza 1", createdAt: FixedNow, region: HallRegion.Gaza));

        var result = await CreateService(fakeRepository).GetFeaturedHallsAsync(HallRegion.MiddleArea);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetFeaturedHallsAsync_WithRegion_LimitsToSixAndMapsAvailability()
    {
        var fakeRepository = new FakeHallRepository();
        for (var index = 0; index < 8; index++)
        {
            fakeRepository.Halls.Add(CreateHall(
                name: $"Gaza {index}",
                createdAt: FixedNow.AddDays(-index),
                region: HallRegion.Gaza));
        }

        var result = await CreateService(fakeRepository).GetFeaturedHallsAsync(HallRegion.Gaza);

        Assert.Equal(FeaturedHallsService.FeatureCount, result.Count);
        Assert.All(result, featured => Assert.Equal(FeaturedHallsService.AvailabilityDays, featured.Availability.Count));
        Assert.All(result, featured => Assert.All(featured.Availability, day => Assert.Equal(3, day.Slots.Count)));
    }

    [Fact]
    public async Task GetFeaturedHallsAsync_WithNoRegion_ReturnsHallsAcrossRegions()
    {
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(CreateHall(name: "North 1", createdAt: FixedNow, region: HallRegion.NorthGaza));
        fakeRepository.Halls.Add(CreateHall(name: "Gaza 1", createdAt: FixedNow.AddDays(-1), region: HallRegion.Gaza));
        fakeRepository.Halls.Add(CreateHall(name: "Middle 1", createdAt: FixedNow.AddDays(-2), region: HallRegion.MiddleArea));
        fakeRepository.Halls.Add(CreateHall(name: "South 1", createdAt: FixedNow.AddDays(-3), region: HallRegion.SouthGaza));

        var result = await CreateService(fakeRepository).GetFeaturedHallsAsync();

        Assert.Equal(4, result.Count);
        Assert.All(result, featured => Assert.NotNull(featured.Availability));
    }

    private static FeaturedHallsService CreateService(
        FakeHallRepository repository,
        FakeHourlySlotService? hourlySlotService = null)
        => new(
            repository,
            new FakeDateTime(FixedNow),
            hourlySlotService ?? new FakeHourlySlotService(),
            NullLogger<FeaturedHallsService>.Instance);

    private static Hall CreateHall(
        string name,
        DateTimeOffset createdAt,
        HallRegion region = HallRegion.Gaza,
        string address = "Gaza City",
        int capacity = 200,
        decimal? price = 1500m,
        string? description = "A beautiful wedding hall.")
        => new()
        {
            Id = Guid.NewGuid(),
            Name = name,
            Region = region,
            Address = address,
            Capacity = capacity,
            Price = price,
            ShowPrice = true,
            Description = description,
            Status = HallStatus.Approved,
            CreatedAt = createdAt
        };

    private sealed class FakeHallRepository : IHallRepository
    {
        public List<Hall> Halls { get; } = [];

        public List<HallImage> Images { get; } = [];

        public Task<Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default)
            => Task.FromResult(Halls.FirstOrDefault(hall => hall.Id == id));

        public Task<IReadOnlyList<Hall>> GetApprovedHallsAsync(int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(Halls.Take(count).ToList());

        public Task<IReadOnlyList<Hall>> GetApprovedHallsPaginatedAsync(
            int skip,
            int take,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(Halls.Skip(skip).Take(take).ToList());

        public Task<int> GetApprovedHallsCountAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(Halls.Count);

        public Task<IReadOnlyList<Hall>> SearchApprovedHallsAsync(
            string? name,
            HallRegion? region,
            string? area,
            DateOnly? date,
            TimeOnly? startTime,
            int skip,
            int take,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(Halls.Skip(skip).Take(take).ToList());

        public Task<int> SearchApprovedHallsCountAsync(
            string? name,
            HallRegion? region,
            string? area,
            DateOnly? date,
            TimeOnly? startTime,
            CancellationToken cancellationToken = default)
            => Task.FromResult(Halls.Count);

        public Task<IReadOnlyList<Hall>> GetApprovedHallsByRegionAsync(
            HallRegion region,
            int count,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(
                Halls.Where(hall => hall.Region == region).Take(count).ToList());

        public Task<IReadOnlyList<HallImage>> GetHallImagesAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallImage>>(
                Images.Where(image => image.HallId == hallId && !image.IsDeleted)
                    .OrderBy(image => image.DisplayOrder)
                    .ThenBy(image => image.CreatedAt)
                    .ToList());
    }

    private sealed class FakeDateTime : IDateTime
    {
        public FakeDateTime(DateTimeOffset now)
        {
            Now = now;
        }

        public DateTimeOffset Now { get; }
    }
}
