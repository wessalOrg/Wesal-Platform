using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Halls;
using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

public class HallDetailsServiceShould
{
    private static readonly DateTimeOffset FixedNow = new(2026, 8, 6, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task GetHallDetailsAsync_ApprovedHall_ReturnsMappedDetails()
    {
        var hall = CreateHall(
            name: "Al-Nasr Hall",
            region: HallRegion.Gaza,
            address: "Al-Nasr Street, Gaza",
            capacity: 300,
            price: 2500m,
            description: "Spacious hall in the heart of Gaza.");
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository);

        var result = await service.GetHallDetailsAsync(hall.Id);

        Assert.Equal(hall.Id, result.HallId);
        Assert.Equal("Al-Nasr Hall", result.HallName);
        Assert.Equal("Gaza", result.Region);
        Assert.Equal("Al-Nasr Street, Gaza", result.Address);
        Assert.Equal(300, result.Capacity);
        Assert.Equal(2500m, result.Price);
        Assert.Equal("Spacious hall in the heart of Gaza.", result.Description);
        Assert.Equal(HallStatus.Approved, result.Status);
        Assert.False(result.IsOwner);
        Assert.Equal(FeaturedHallsService.AvailabilityDays, result.Availability.Count);
    }

    [Fact]
    public async Task GetHallDetailsAsync_UnknownHall_ThrowsNotFound()
    {
        var service = CreateService(new FakeHallRepository());

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetHallDetailsAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task GetHallDetailsAsync_PendingHall_ThrowsNotFound()
    {
        var hall = CreateHall(name: "Pending Hall");
        hall.Status = HallStatus.PendingReview;
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository);

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetHallDetailsAsync(hall.Id));
    }

    [Fact]
    public async Task GetHallDetailsAsync_RejectedHall_ThrowsNotFound()
    {
        var hall = CreateHall(name: "Rejected Hall");
        hall.Status = HallStatus.Rejected;
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository);

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetHallDetailsAsync(hall.Id));
    }

    [Fact]
    public async Task GetHallDetailsAsync_DeletedHall_ThrowsNotFound()
    {
        var hall = CreateHall(name: "Deleted Hall");
        hall.IsDeleted = true;
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository);

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetHallDetailsAsync(hall.Id));
    }

    [Fact]
    public async Task GetHallDetailsAsync_OwnerUser_SetsIsOwnerTrue()
    {
        var hall = CreateHall(name: "Owner Hall");
        hall.OwnerId = "owner-user-id";
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(
            fakeRepository,
            currentUser: new FakeCurrentUserService("owner-user-id", authenticated: true));

        var result = await service.GetHallDetailsAsync(hall.Id);

        Assert.True(result.IsOwner);
    }

    [Fact]
    public async Task GetHallDetailsAsync_NonOwnerUser_SetsIsOwnerFalse()
    {
        var hall = CreateHall(name: "Owner Hall");
        hall.OwnerId = "owner-user-id";
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(
            fakeRepository,
            currentUser: new FakeCurrentUserService("another-user-id", authenticated: true));

        var result = await service.GetHallDetailsAsync(hall.Id);

        Assert.False(result.IsOwner);
    }

    [Fact]
    public async Task GetHallDetailsAsync_GuestUser_SetsIsOwnerFalse()
    {
        var hall = CreateHall(name: "Owner Hall");
        hall.OwnerId = "owner-user-id";
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository, currentUser: new FakeCurrentUserService(null, authenticated: false));

        var result = await service.GetHallDetailsAsync(hall.Id);

        Assert.False(result.IsOwner);
    }

    [Fact]
    public async Task GetHallDetailsAsync_HidesPriceWhenShowPriceIsFalse()
    {
        var hall = CreateHall(name: "Hidden Price Hall", price: 2000m);
        hall.ShowPrice = false;
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository);

        var result = await service.GetHallDetailsAsync(hall.Id);

        Assert.Null(result.Price);
    }

    [Fact]
    public async Task GetHallDetailsAsync_PreservesGalleryOrder()
    {
        var hall = CreateHall(name: "Gallery Hall");
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);
        fakeRepository.Images.Add(CreateImage(hall.Id, "second.jpg", displayOrder: 2, createdAt: FixedNow.AddMinutes(-2)));
        fakeRepository.Images.Add(CreateImage(hall.Id, "first.jpg", displayOrder: 1, createdAt: FixedNow.AddMinutes(-1)));

        var service = CreateService(fakeRepository);

        var result = await service.GetHallDetailsAsync(hall.Id);

        Assert.Collection(
            result.Photos,
            photo => Assert.Equal("first.jpg", photo.Url),
            photo => Assert.Equal("second.jpg", photo.Url));
    }

    [Fact]
    public async Task GetHallDetailsAsync_SkipsImagesWithInvalidUrls()
    {
        var hall = CreateHall(name: "Gallery Hall");
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);
        fakeRepository.Images.Add(CreateImage(hall.Id, "valid.jpg", displayOrder: 1, createdAt: FixedNow));
        fakeRepository.Images.Add(CreateImage(hall.Id, string.Empty, displayOrder: 2, createdAt: FixedNow));
        fakeRepository.Images.Add(CreateImage(hall.Id, "   ", displayOrder: 3, createdAt: FixedNow));
        fakeRepository.Images.Add(CreateImage(hall.Id, null!, displayOrder: 4, createdAt: FixedNow));

        var service = CreateService(fakeRepository);

        var result = await service.GetHallDetailsAsync(hall.Id);

        var photo = Assert.Single(result.Photos);
        Assert.Equal("valid.jpg", photo.Url);
    }

    [Fact]
    public async Task GetHallDetailsAsync_ExposesHourlySlotsForEachDay()
    {
        var hall = CreateHall(name: "Hourly Hall");
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var result = await CreateService(fakeRepository).GetHallDetailsAsync(hall.Id);

        Assert.Equal(FeaturedHallsService.AvailabilityDays, result.Availability.Count);
        Assert.All(result.Availability, day => Assert.Equal(3, day.Slots.Count));
        Assert.All(result.Availability, day => Assert.Equal(new TimeOnly(9, 0), day.Slots[0].StartTime));
    }

    [Fact]
    public async Task GetHallDetailsAsync_ResolvesHourlySlotStatusFromCatalog()
    {
        var hall = CreateHall(name: "Availability Hall");
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

        var result = await CreateService(fakeRepository, hourlySlotService: hourly).GetHallDetailsAsync(hall.Id);
        var day = result.Availability.Single(item => item.Date == firstDay);

        Assert.Equal(HallSlotStatus.Booked, day.Slots[0].Status);
        Assert.Equal(HallSlotStatus.Available, day.Slots[1].Status);
    }

    [Fact]
    public async Task GetHallDetailsAsync_AdminLockedHall_ThrowsNotFound()
    {
        var hall = CreateHall(name: "Admin Locked Hall");
        hall.IsAdminLocked = true;
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository);

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetHallDetailsAsync(hall.Id));
    }

    [Fact]
    public async Task GetHallDetailsAsync_SystemLockedHall_ThrowsNotFound()
    {
        var hall = CreateHall(name: "System Locked Hall");
        hall.SystemLocked = true;
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository);

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetHallDetailsAsync(hall.Id));
    }

    // --- US-ADMIN-10 / US-OWNER-31: public details require Approved AND Paid ---

    [Fact]
    public async Task GetHallDetailsAsync_ApprovedButUnpaidHall_ThrowsNotFound()
    {
        var hall = CreateHall(name: "Unpaid Hall");
        hall.PaymentStatus = HallPaymentStatus.Unpaid;
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository);

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetHallDetailsAsync(hall.Id));
    }

    [Fact]
    public async Task GetHallDetailsAsync_ApprovedAndPaidHall_ReturnsDetails()
    {
        var hall = CreateHall(name: "Visible Hall");
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository);
        var details = await service.GetHallDetailsAsync(hall.Id);

        Assert.Equal("Visible Hall", details.HallName);
    }

    private static HallDetailsService CreateService(
        FakeHallRepository repository,
        FakeCurrentUserService? currentUser = null,
        FakeHourlySlotService? hourlySlotService = null)
        => new(
            repository,
            currentUser ?? new FakeCurrentUserService(null, authenticated: false),
            new FakeDateTime(FixedNow),
            hourlySlotService ?? new FakeHourlySlotService(),
            NullLogger<HallDetailsService>.Instance);

    private static Hall CreateHall(
        string name,
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
            PaymentStatus = HallPaymentStatus.Paid,
            CreatedAt = FixedNow
        };

    private static HallImage CreateImage(Guid hallId, string url, int displayOrder, DateTimeOffset createdAt)
        => new()
        {
            Id = Guid.NewGuid(),
            HallId = hallId,
            Url = url,
            DisplayOrder = displayOrder,
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
            string? name, HallRegion? region, string? area,
            DateOnly? date, TimeOnly? startTime,
            int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(Halls.Skip(skip).Take(take).ToList());

        public Task<int> SearchApprovedHallsCountAsync(
            string? name, HallRegion? region, string? area,
            DateOnly? date, TimeOnly? startTime,
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

    private sealed class FakeCurrentUserService : ICurrentUserService
    {
        public FakeCurrentUserService(string? userId, bool authenticated)
        {
            UserId = userId;
            IsAuthenticated = authenticated;
        }

        public string? UserId { get; }

        public string? UserName => null;

        public string? Email => null;

        public bool IsAuthenticated { get; }

        public IReadOnlyList<string> Roles => [];
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
