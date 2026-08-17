using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.Halls;

namespace Wesal.Tests.Infrastructure;

public class AllHallsServiceShould
{
    private static readonly DateTimeOffset FixedNow = new(2026, 8, 6, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task GetApprovedHallsAsync_ReturnsPaginatedHalls()
    {
        var fakeRepository = new FakeHallRepository();
        for (var index = 0; index < 5; index++)
        {
            fakeRepository.Halls.Add(CreateHall(name: $"Hall {index}", createdAt: FixedNow.AddDays(-index)));
        }

        var service = CreateService(fakeRepository);

        var result = await service.GetApprovedHallsAsync(pageNumber: 1, pageSize: 3);

        Assert.Equal(3, result.Items.Count);
        Assert.Equal("Hall 0", result.Items[0].HallName);
        Assert.Equal("Hall 1", result.Items[1].HallName);
        Assert.Equal("Hall 2", result.Items[2].HallName);
    }

    [Fact]
    public async Task GetApprovedHallsAsync_ReturnsSecondPage()
    {
        var fakeRepository = new FakeHallRepository();
        for (var index = 0; index < 5; index++)
        {
            fakeRepository.Halls.Add(CreateHall(name: $"Hall {index}", createdAt: FixedNow.AddDays(-index)));
        }

        var service = CreateService(fakeRepository);

        var result = await service.GetApprovedHallsAsync(pageNumber: 2, pageSize: 3);

        Assert.Equal(2, result.Items.Count);
        Assert.Equal("Hall 3", result.Items[0].HallName);
        Assert.Equal("Hall 4", result.Items[1].HallName);
    }

    [Fact]
    public async Task GetApprovedHallsAsync_ReturnsEmptyPageWhenOutOfBounds()
    {
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(CreateHall(name: "Only Hall", createdAt: FixedNow));

        var service = CreateService(fakeRepository);

        var result = await service.GetApprovedHallsAsync(pageNumber: 5, pageSize: 3);

        Assert.Empty(result.Items);
        Assert.Equal(5, result.PageNumber);
        Assert.Equal(1, result.TotalPages);
    }

    [Fact]
    public async Task GetApprovedHallsAsync_ExcludesUnapprovedAndDeletedHalls()
    {
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(CreateHall(name: "Approved", createdAt: FixedNow));
        var pending = CreateHall(name: "Pending", createdAt: FixedNow);
        pending.Status = HallStatus.PendingReview;
        fakeRepository.Halls.Add(pending);
        var deleted = CreateHall(name: "Deleted", createdAt: FixedNow);
        deleted.IsDeleted = true;
        fakeRepository.Halls.Add(deleted);

        var service = CreateService(fakeRepository);

        var result = await service.GetApprovedHallsAsync(pageNumber: 1, pageSize: 10);

        var item = Assert.Single(result.Items);
        Assert.Equal("Approved", item.HallName);
    }

    [Fact]
    public async Task GetApprovedHallsAsync_HidesPriceWhenShowPriceIsFalse()
    {
        var fakeRepository = new FakeHallRepository();
        var hall = CreateHall(name: "Hidden Price", createdAt: FixedNow, price: 2000m);
        hall.ShowPrice = false;
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository);

        var result = await service.GetApprovedHallsAsync(pageNumber: 1, pageSize: 10);

        var item = Assert.Single(result.Items);
        Assert.Null(item.Price);
    }

    [Fact]
    public async Task GetApprovedHallsAsync_MapsRegionToDisplayName()
    {
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(CreateHall(name: "North Hall", createdAt: FixedNow, region: HallRegion.NorthGaza));
        fakeRepository.Halls.Add(CreateHall(name: "Gaza Hall", createdAt: FixedNow.AddDays(-1), region: HallRegion.Gaza));
        fakeRepository.Halls.Add(CreateHall(name: "Middle Hall", createdAt: FixedNow.AddDays(-2), region: HallRegion.MiddleArea));
        fakeRepository.Halls.Add(CreateHall(name: "South Hall", createdAt: FixedNow.AddDays(-3), region: HallRegion.SouthGaza));

        var service = CreateService(fakeRepository);

        var result = await service.GetApprovedHallsAsync(pageNumber: 1, pageSize: 10);

        Assert.Equal("North Gaza", result.Items[0].Region);
        Assert.Equal("Gaza", result.Items[1].Region);
        Assert.Equal("Middle Area", result.Items[2].Region);
        Assert.Equal("South Gaza", result.Items[3].Region);
    }

    [Fact]
    public async Task GetApprovedHallsAsync_PaginationMetadataIsCorrect()
    {
        var fakeRepository = new FakeHallRepository();
        for (var index = 0; index < 10; index++)
        {
            fakeRepository.Halls.Add(CreateHall(name: $"Hall {index}", createdAt: FixedNow.AddDays(-index)));
        }

        var service = CreateService(fakeRepository);

        var page1 = await service.GetApprovedHallsAsync(pageNumber: 1, pageSize: 3);
        Assert.Equal(10, page1.TotalCount);
        Assert.Equal(4, page1.TotalPages);
        Assert.False(page1.HasPreviousPage);
        Assert.True(page1.HasNextPage);

        var page4 = await service.GetApprovedHallsAsync(pageNumber: 4, pageSize: 3);
        Assert.True(page4.HasPreviousPage);
        Assert.False(page4.HasNextPage);
        Assert.Single(page4.Items);
    }

    private static AllHallsService CreateService(FakeHallRepository repository)
        => new(repository);

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
            => Task.FromResult<IReadOnlyList<Hall>>(
                Halls.Where(hall => hall.Status == HallStatus.Approved && !hall.IsDeleted)
                    .OrderByDescending(hall => hall.CreatedAt)
                    .ThenBy(hall => hall.Name)
                    .Skip(skip)
                    .Take(take)
                    .ToList());

        public Task<int> GetApprovedHallsCountAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(
                Halls.Count(hall => hall.Status == HallStatus.Approved && !hall.IsDeleted));

        public Task<IReadOnlyList<Hall>> SearchApprovedHallsAsync(
            string? name,
            HallRegion? region,
            string? area,
            DateOnly? date,
            BookingPeriodType? period,
            int skip,
            int take,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(
                ApplySearch(name, region, area).Skip(skip).Take(take).ToList());

        public Task<int> SearchApprovedHallsCountAsync(
            string? name,
            HallRegion? region,
            string? area,
            DateOnly? date,
            BookingPeriodType? period,
            CancellationToken cancellationToken = default)
            => Task.FromResult<int>(ApplySearch(name, region, area).Count());

        private IEnumerable<Hall> ApplySearch(string? name, HallRegion? region, string? area)
            => Halls
                .Where(hall => hall.Status == HallStatus.Approved && !hall.IsDeleted)
                .Where(hall => name == null || hall.Name.Contains(name))
                .Where(hall => !region.HasValue || hall.Region == region.Value)
                .Where(hall => area == null || hall.Address.Contains(area));

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
}
