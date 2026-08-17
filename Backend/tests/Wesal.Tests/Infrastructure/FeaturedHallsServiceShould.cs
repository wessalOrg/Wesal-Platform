using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.Halls;

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
            var hall = CreateHall(name: $"Hall {index}", createdAt: FixedNow.AddDays(-index));
            fakeRepository.Halls.Add(hall);
            fakeRepository.Periods.AddRange(CreatePeriods(hall.Id));
        }

        var service = CreateService(fakeRepository);

        var result = await service.GetFeaturedHallsAsync();

        Assert.Equal(6, result.Count);
    }

    [Fact]
    public async Task GetFeaturedHallsAsync_ReturnsEmptyListWhenNoHallsExist()
    {
        var service = CreateService(new FakeHallRepository());

        var result = await service.GetFeaturedHallsAsync();

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
        fakeRepository.Periods.AddRange(CreatePeriods(hall.Id));

        var service = CreateService(fakeRepository);

        var result = await service.GetFeaturedHallsAsync();
        var featured = Assert.Single(result);

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
        fakeRepository.Periods.AddRange(CreatePeriods(hall.Id));

        var service = CreateService(fakeRepository);

        var result = await service.GetFeaturedHallsAsync();
        var featured = Assert.Single(result);

        Assert.Null(featured.Price);
    }

    [Fact]
    public async Task GetFeaturedHallsAsync_ExposesBookingPeriodsForEachDay()
    {
        var hall = CreateHall(name: "Two Period Hall", createdAt: FixedNow);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);
        fakeRepository.Periods.AddRange(CreatePeriods(hall.Id));

        var service = CreateService(fakeRepository);

        var result = await service.GetFeaturedHallsAsync();
        var featured = Assert.Single(result);

        Assert.Equal(FeaturedHallsService.AvailabilityDays, featured.Availability.Count);

        var firstDay = featured.Availability[0];
        Assert.Equal(2, firstDay.Periods.Count);
        Assert.Equal(BookingPeriodType.FirstPeriod, firstDay.Periods[0].PeriodType);
        Assert.Equal(BookingPeriodType.SecondPeriod, firstDay.Periods[1].PeriodType);
    }

    [Fact]
    public async Task GetFeaturedHallsAsync_ResolvesAvailabilityStatusFromStore()
    {
        var hall = CreateHall(name: "Availability Hall", createdAt: FixedNow);
        var firstDay = DateOnly.FromDateTime(FixedNow.UtcDateTime);

        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);
        fakeRepository.Periods.AddRange(CreatePeriods(hall.Id));
        fakeRepository.Availability.Add(new HallAvailability
        {
            HallId = hall.Id,
            Date = firstDay,
            PeriodType = BookingPeriodType.FirstPeriod,
            Status = AvailabilityStatus.Booked
        });

        var service = CreateService(fakeRepository);

        var result = await service.GetFeaturedHallsAsync();
        var featured = Assert.Single(result);
        var day = featured.Availability.Single(item => item.Date == firstDay);

        Assert.Equal(AvailabilityStatus.Booked, day.Periods[0].Status);
        Assert.Equal(AvailabilityStatus.Available, day.Periods[1].Status);
    }

    [Fact]
    public async Task GetFeaturedHallsAsync_DefaultsUnrecordedPeriodsToAvailable()
    {
        var hall = CreateHall(name: "No Availability Hall", createdAt: FixedNow);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);
        fakeRepository.Periods.AddRange(CreatePeriods(hall.Id));

        var service = CreateService(fakeRepository);

        var result = await service.GetFeaturedHallsAsync();
        var featured = Assert.Single(result);

        Assert.All(featured.Availability, day => Assert.All(day.Periods, period => Assert.Equal(AvailabilityStatus.Available, period.Status)));
    }

    [Fact]
    public async Task GetFeaturedHallsAsync_WithRegion_FiltersHallsByRegion()
    {
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(CreateHall(name: "North 1", createdAt: FixedNow, region: HallRegion.NorthGaza));
        fakeRepository.Halls.Add(CreateHall(name: "Gaza 1", createdAt: FixedNow.AddDays(-1), region: HallRegion.Gaza));
        fakeRepository.Halls.Add(CreateHall(name: "Gaza 2", createdAt: FixedNow.AddDays(-2), region: HallRegion.Gaza));
        fakeRepository.Halls.Add(CreateHall(name: "South 1", createdAt: FixedNow.AddDays(-3), region: HallRegion.SouthGaza));
        foreach (var hall in fakeRepository.Halls)
        {
            fakeRepository.Periods.AddRange(CreatePeriods(hall.Id));
        }

        var service = CreateService(fakeRepository);

        var result = await service.GetFeaturedHallsAsync(HallRegion.Gaza);

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
        fakeRepository.Periods.AddRange(CreatePeriods(fakeRepository.Halls[0].Id));

        var service = CreateService(fakeRepository);

        var result = await service.GetFeaturedHallsAsync(HallRegion.MiddleArea);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetFeaturedHallsAsync_WithRegion_LimitsToSixAndMapsAvailability()
    {
        var fakeRepository = new FakeHallRepository();
        for (var index = 0; index < 8; index++)
        {
            var hall = CreateHall(name: $"Gaza {index}", createdAt: FixedNow.AddDays(-index), region: HallRegion.Gaza);
            fakeRepository.Halls.Add(hall);
            fakeRepository.Periods.AddRange(CreatePeriods(hall.Id));
        }

        var service = CreateService(fakeRepository);

        var result = await service.GetFeaturedHallsAsync(HallRegion.Gaza);

        Assert.Equal(FeaturedHallsService.FeatureCount, result.Count);
        Assert.All(result, featured => Assert.Equal(FeaturedHallsService.AvailabilityDays, featured.Availability.Count));
        Assert.All(result, featured => Assert.All(featured.Availability, day => Assert.Equal(2, day.Periods.Count)));
    }

    [Fact]
    public async Task GetFeaturedHallsAsync_WithNoRegion_ReturnsHallsAcrossRegions()
    {
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(CreateHall(name: "North 1", createdAt: FixedNow, region: HallRegion.NorthGaza));
        fakeRepository.Halls.Add(CreateHall(name: "Gaza 1", createdAt: FixedNow.AddDays(-1), region: HallRegion.Gaza));
        fakeRepository.Halls.Add(CreateHall(name: "Middle 1", createdAt: FixedNow.AddDays(-2), region: HallRegion.MiddleArea));
        fakeRepository.Halls.Add(CreateHall(name: "South 1", createdAt: FixedNow.AddDays(-3), region: HallRegion.SouthGaza));
        foreach (var hall in fakeRepository.Halls)
        {
            fakeRepository.Periods.AddRange(CreatePeriods(hall.Id));
        }

        var service = CreateService(fakeRepository);

        var result = await service.GetFeaturedHallsAsync();

        Assert.Equal(4, result.Count);
        Assert.All(result, featured => Assert.NotNull(featured.Availability));
    }

    private static FeaturedHallsService CreateService(FakeHallRepository repository)
        => new(repository, new FakeDateTime(FixedNow), NullLogger<FeaturedHallsService>.Instance);

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

    private static IEnumerable<HallBookingPeriod> CreatePeriods(Guid hallId)
    {
        yield return new HallBookingPeriod
        {
            HallId = hallId,
            Type = BookingPeriodType.FirstPeriod,
            StartTime = new TimeOnly(12, 0),
            EndTime = new TimeOnly(15, 0)
        };

        yield return new HallBookingPeriod
        {
            HallId = hallId,
            Type = BookingPeriodType.SecondPeriod,
            StartTime = new TimeOnly(16, 0),
            EndTime = new TimeOnly(20, 0)
        };
    }

    private sealed class FakeHallRepository : IHallRepository
    {
        public List<Hall> Halls { get; } = [];

        public List<HallImage> Images { get; } = [];

        public List<HallBookingPeriod> Periods { get; } = [];

        public List<HallAvailability> Availability { get; } = [];

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
            string? name, HallRegion? region, string? area,
            DateOnly? date, BookingPeriodType? period,
            int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(Halls.Skip(skip).Take(take).ToList());

        public Task<int> SearchApprovedHallsCountAsync(
            string? name, HallRegion? region, string? area,
            DateOnly? date, BookingPeriodType? period,
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

        public Task<IReadOnlyList<HallBookingPeriod>> GetBookingPeriodsAsync(
            IReadOnlyCollection<Guid> hallIds,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallBookingPeriod>>(Periods.Where(period => hallIds.Contains(period.HallId)).ToList());

        public Task<IReadOnlyList<HallAvailability>> GetAvailabilityAsync(
            IReadOnlyCollection<Guid> hallIds,
            DateOnly fromDate,
            DateOnly toDate,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallAvailability>>(
                Availability.Where(item => hallIds.Contains(item.HallId) && item.Date >= fromDate && item.Date <= toDate).ToList());
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
