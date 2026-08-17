using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.Halls;

namespace Wesal.Tests.Infrastructure;

public class HallSearchServiceShould
{
    private static readonly DateTimeOffset FixedNow = new(2026, 8, 10, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task SearchHallsAsync_SearchByName_ReturnsMatchingHalls()
    {
        var repository = new FakeHallRepository();
        repository.Halls.Add(CreateHall(name: "Royal Palace", createdAt: FixedNow));
        repository.Halls.Add(CreateHall(name: "Royal Garden", createdAt: FixedNow.AddDays(-1)));
        repository.Halls.Add(CreateHall(name: "Al-Nasr Hall", createdAt: FixedNow.AddDays(-2)));

        var service = CreateService(repository);

        var result = await service.SearchHallsAsync(new HallSearchRequest { Name = "Royal" });

        Assert.Equal(2, result.Items.Count);
        Assert.All(result.Items, item => Assert.Contains("Royal", item.HallName));
    }

    [Fact]
    public async Task SearchHallsAsync_FilterByRegion_ReturnsOnlyMatchingRegion()
    {
        var repository = new FakeHallRepository();
        repository.Halls.Add(CreateHall(name: "Gaza Hall", createdAt: FixedNow, region: HallRegion.Gaza));
        repository.Halls.Add(CreateHall(name: "North Hall", createdAt: FixedNow.AddDays(-1), region: HallRegion.NorthGaza));
        repository.Halls.Add(CreateHall(name: "South Hall", createdAt: FixedNow.AddDays(-2), region: HallRegion.SouthGaza));

        var service = CreateService(repository);

        var result = await service.SearchHallsAsync(new HallSearchRequest { Region = HallRegion.Gaza });

        var item = Assert.Single(result.Items);
        Assert.Equal("Gaza Hall", item.HallName);
        Assert.Equal("Gaza", item.Region);
    }

    [Fact]
    public async Task SearchHallsAsync_FilterByArea_ReturnsMatchingAddress()
    {
        var repository = new FakeHallRepository();
        repository.Halls.Add(CreateHall(name: "Hall A", createdAt: FixedNow, address: "Tel Al-Hawa, Gaza"));
        repository.Halls.Add(CreateHall(name: "Hall B", createdAt: FixedNow.AddDays(-1), address: "Rimal, Gaza"));
        repository.Halls.Add(CreateHall(name: "Hall C", createdAt: FixedNow.AddDays(-2), address: "Tel Al-Sultan, Khan Younis"));

        var service = CreateService(repository);

        var result = await service.SearchHallsAsync(new HallSearchRequest { Area = "Tel" });

        Assert.Equal(2, result.Items.Count);
        Assert.All(result.Items, item => Assert.Contains("Tel", item.Address));
    }

    [Fact]
    public async Task SearchHallsAsync_DateFilter_IsPassedToRepository()
    {
        var repository = new FakeHallRepository();
        repository.Halls.Add(CreateHall(name: "Hall A", createdAt: FixedNow));
        repository.Halls.Add(CreateHall(name: "Hall B", createdAt: FixedNow.AddDays(-1)));

        var service = CreateService(repository);
        var searchDate = new DateOnly(2026, 8, 15);

        var result = await service.SearchHallsAsync(new HallSearchRequest { Date = searchDate });

        Assert.NotNull(repository.LastSearchRequest);
        Assert.Equal(searchDate, repository.LastSearchRequest.Date);
    }

    [Fact]
    public async Task SearchHallsAsync_PeriodFilter_IsPassedToRepository()
    {
        var repository = new FakeHallRepository();
        repository.Halls.Add(CreateHall(name: "Hall A", createdAt: FixedNow));

        var service = CreateService(repository);

        var result = await service.SearchHallsAsync(new HallSearchRequest { Period = BookingPeriodType.SecondPeriod });

        Assert.NotNull(repository.LastSearchRequest);
        Assert.Equal(BookingPeriodType.SecondPeriod, repository.LastSearchRequest.Period);
    }

    [Fact]
    public async Task SearchHallsAsync_MultipleFilters_UsesAndLogic()
    {
        var repository = new FakeHallRepository();
        repository.Halls.Add(CreateHall(name: "Royal Palace", createdAt: FixedNow, region: HallRegion.Gaza, address: "Tel Al-Hawa"));
        repository.Halls.Add(CreateHall(name: "Royal Garden", createdAt: FixedNow.AddDays(-1), region: HallRegion.NorthGaza, address: "Jalaa Street"));
        repository.Halls.Add(CreateHall(name: "Royal Hall", createdAt: FixedNow.AddDays(-2), region: HallRegion.NorthGaza, address: "Rimal"));

        var service = CreateService(repository);

        var result = await service.SearchHallsAsync(new HallSearchRequest
        {
            Name = "Royal",
            Region = HallRegion.Gaza
        });

        var item = Assert.Single(result.Items);
        Assert.Equal("Royal Palace", item.HallName);
        Assert.Equal("Gaza", item.Region);
    }

    [Fact]
    public async Task SearchHallsAsync_EmptyFilters_ReturnsAllApprovedHalls()
    {
        var repository = new FakeHallRepository();
        repository.Halls.Add(CreateHall(name: "Hall A", createdAt: FixedNow));
        repository.Halls.Add(CreateHall(name: "Hall B", createdAt: FixedNow.AddDays(-1)));
        repository.Halls.Add(CreateHall(name: "Hall C", createdAt: FixedNow.AddDays(-2)));

        var service = CreateService(repository);

        var result = await service.SearchHallsAsync(new HallSearchRequest());

        Assert.Equal(3, result.Items.Count);
    }

    [Fact]
    public async Task SearchHallsAsync_PaginationMetadataIsCorrect()
    {
        var repository = new FakeHallRepository();
        for (var i = 0; i < 10; i++)
        {
            repository.Halls.Add(CreateHall(name: $"Hall {i}", createdAt: FixedNow.AddDays(-i)));
        }

        var service = CreateService(repository);

        var page1 = await service.SearchHallsAsync(new HallSearchRequest { PageNumber = 1, PageSize = 3 });
        Assert.Equal(10, page1.TotalCount);
        Assert.Equal(4, page1.TotalPages);
        Assert.False(page1.HasPreviousPage);
        Assert.True(page1.HasNextPage);
        Assert.Equal(3, page1.Items.Count);

        var page4 = await service.SearchHallsAsync(new HallSearchRequest { PageNumber = 4, PageSize = 3 });
        Assert.True(page4.HasPreviousPage);
        Assert.False(page4.HasNextPage);
        Assert.Single(page4.Items);
    }

    [Fact]
    public async Task SearchHallsAsync_EmptyResults_ReturnsEmptyPagedResult()
    {
        var repository = new FakeHallRepository();
        repository.Halls.Add(CreateHall(name: "Hall A", createdAt: FixedNow));

        var service = CreateService(repository);

        var result = await service.SearchHallsAsync(new HallSearchRequest { Name = "NonExistent" });

        Assert.Empty(result.Items);
        Assert.Equal(0, result.TotalCount);
        Assert.Equal(0, result.TotalPages);
    }

    [Fact]
    public async Task SearchHallsAsync_PageSizeIsClamped()
    {
        var repository = new FakeHallRepository();
        for (var i = 0; i < 5; i++)
        {
            repository.Halls.Add(CreateHall(name: $"Hall {i}", createdAt: FixedNow.AddDays(-i)));
        }

        var service = CreateService(repository);

        var resultZero = await service.SearchHallsAsync(new HallSearchRequest { PageSize = 0 });
        Assert.True(resultZero.Items.Count <= 50);

        var resultHuge = await service.SearchHallsAsync(new HallSearchRequest { PageSize = 1000 });
        Assert.True(resultHuge.Items.Count <= 50);
    }

    [Fact]
    public async Task SearchHallsAsync_OnlyApprovedHallsReturned()
    {
        var repository = new FakeHallRepository();
        repository.Halls.Add(CreateHall(name: "Approved", createdAt: FixedNow));
        var pending = CreateHall(name: "Pending", createdAt: FixedNow.AddDays(-1));
        pending.Status = HallStatus.PendingReview;
        repository.Halls.Add(pending);
        var deleted = CreateHall(name: "Deleted", createdAt: FixedNow.AddDays(-2));
        deleted.IsDeleted = true;
        repository.Halls.Add(deleted);

        var service = CreateService(repository);

        var result = await service.SearchHallsAsync(new HallSearchRequest());

        var item = Assert.Single(result.Items);
        Assert.Equal("Approved", item.HallName);
    }

    private static HallSearchService CreateService(FakeHallRepository repository)
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
        public HallSearchRequest? LastSearchRequest { get; private set; }

        public Task<Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default)
            => Task.FromResult(Halls.FirstOrDefault(hall => hall.Id == id));

        public Task<IReadOnlyList<Hall>> GetApprovedHallsAsync(int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(Halls.Take(count).ToList());

        public Task<IReadOnlyList<Hall>> GetApprovedHallsPaginatedAsync(
            int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(
                Halls.Where(h => h.Status == HallStatus.Approved && !h.IsDeleted)
                    .OrderByDescending(h => h.CreatedAt).ThenBy(h => h.Name)
                    .Skip(skip).Take(take).ToList());

        public Task<int> GetApprovedHallsCountAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(Halls.Count(h => h.Status == HallStatus.Approved && !h.IsDeleted));

        public Task<IReadOnlyList<Hall>> SearchApprovedHallsAsync(
            string? name, HallRegion? region, string? area,
            DateOnly? date, BookingPeriodType? period,
            int skip, int take, CancellationToken cancellationToken = default)
        {
            LastSearchRequest = new HallSearchRequest
            {
                Name = name, Region = region, Area = area,
                Date = date, Period = period
            };

            var query = Halls
                .Where(h => h.Status == HallStatus.Approved && !h.IsDeleted)
                .Where(h => name == null || h.Name.Contains(name))
                .Where(h => !region.HasValue || h.Region == region.Value)
                .Where(h => area == null || h.Address.Contains(area));

            return Task.FromResult<IReadOnlyList<Hall>>(
                query.OrderByDescending(h => h.CreatedAt).ThenBy(h => h.Name)
                    .Skip(skip).Take(take).ToList());
        }

        public Task<int> SearchApprovedHallsCountAsync(
            string? name, HallRegion? region, string? area,
            DateOnly? date, BookingPeriodType? period,
            CancellationToken cancellationToken = default)
        {
            var count = Halls
                .Where(h => h.Status == HallStatus.Approved && !h.IsDeleted)
                .Where(h => name == null || h.Name.Contains(name))
                .Where(h => !region.HasValue || h.Region == region.Value)
                .Where(h => area == null || h.Address.Contains(area))
                .Count();

            return Task.FromResult(count);
        }

        public Task<IReadOnlyList<Hall>> GetApprovedHallsByRegionAsync(
            HallRegion region, int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(
                Halls.Where(h => h.Region == region).Take(count).ToList());

        public Task<IReadOnlyList<HallImage>> GetHallImagesAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallImage>>([]);

        public Task<IReadOnlyList<HallBookingPeriod>> GetBookingPeriodsAsync(
            IReadOnlyCollection<Guid> hallIds, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallBookingPeriod>>([]);

        public Task<IReadOnlyList<HallAvailability>> GetAvailabilityAsync(
            IReadOnlyCollection<Guid> hallIds, DateOnly fromDate, DateOnly toDate,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallAvailability>>([]);
    }
}
