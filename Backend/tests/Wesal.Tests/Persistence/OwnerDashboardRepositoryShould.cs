using Microsoft.EntityFrameworkCore;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Persistence;

public class OwnerDashboardRepositoryShould
{
    [Fact]
    public async Task GetOwnedHalls_ReturnsOnlyOwnersHalls_WithCurrentStatus()
    {
        await using var context = CreateContext();
        var ownerId = Guid.NewGuid().ToString();
        var otherId = Guid.NewGuid().ToString();
        var pending = new Hall { Id = Guid.NewGuid(), Name = "Pending Hall", OwnerId = ownerId, Status = HallStatus.PendingReview };
        var approved = new Hall { Id = Guid.NewGuid(), Name = "Approved Hall", OwnerId = ownerId, Status = HallStatus.Approved };
        var rejected = new Hall { Id = Guid.NewGuid(), Name = "Rejected Hall", OwnerId = ownerId, Status = HallStatus.Rejected };
        var other = new Hall { Id = Guid.NewGuid(), Name = "Other's Hall", OwnerId = otherId, Status = HallStatus.Approved };
        context.Halls.AddRange(pending, approved, rejected, other);
        await context.SaveChangesAsync();

        var repository = new OwnerDashboardRepository(context);

        var result = await repository.GetOwnedHallsAsync(ownerId);

        Assert.Equal(3, result.Count);
        Assert.Contains(result, hall => hall.Id == pending.Id && hall.Status == HallStatus.PendingReview);
        Assert.Contains(result, hall => hall.Id == approved.Id && hall.Status == HallStatus.Approved);
        Assert.Contains(result, hall => hall.Id == rejected.Id && hall.Status == HallStatus.Rejected);
        Assert.DoesNotContain(result, hall => hall.Id == other.Id);
    }

    [Fact]
    public async Task GetOwnedHalls_ExcludesDeletedHalls()
    {
        await using var context = CreateContext();
        var ownerId = Guid.NewGuid().ToString();
        context.Halls.AddRange(
            new Hall { Id = Guid.NewGuid(), Name = "Visible", OwnerId = ownerId, Status = HallStatus.PendingReview },
            new Hall { Id = Guid.NewGuid(), Name = "Deleted", OwnerId = ownerId, Status = HallStatus.PendingReview, IsDeleted = true });
        await context.SaveChangesAsync();

        var repository = new OwnerDashboardRepository(context);

        var result = await repository.GetOwnedHallsAsync(ownerId);

        var hall = Assert.Single(result);
        Assert.Equal("Visible", hall.Name);
    }

    [Fact]
    public async Task GetOwnedHalls_ReturnsEmpty_WhenOwnerHasNoHalls()
    {
        await using var context = CreateContext();

        var repository = new OwnerDashboardRepository(context);

        var result = await repository.GetOwnedHallsAsync(Guid.NewGuid().ToString());

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetOwnedHalls_OrdersByCreatedAtDescending_ThenByName()
    {
        await using var context = CreateContext();
        var ownerId = Guid.NewGuid().ToString();
        var now = new DateTimeOffset(2026, 9, 1, 12, 0, 0, TimeSpan.Zero);
        context.Halls.AddRange(
            new Hall { Id = Guid.NewGuid(), Name = "A", OwnerId = ownerId, Status = HallStatus.PendingReview, CreatedAt = now },
            new Hall { Id = Guid.NewGuid(), Name = "B", OwnerId = ownerId, Status = HallStatus.PendingReview, CreatedAt = now.AddMinutes(-10) },
            new Hall { Id = Guid.NewGuid(), Name = "C", OwnerId = ownerId, Status = HallStatus.PendingReview, CreatedAt = now });
        await context.SaveChangesAsync();

        var repository = new OwnerDashboardRepository(context);

        var result = await repository.GetOwnedHallsAsync(ownerId);

        Assert.Collection(
            result,
            hall => Assert.Equal("A", hall.Name),
            hall => Assert.Equal("C", hall.Name),
            hall => Assert.Equal("B", hall.Name));
    }

    [Fact]
    public async Task GetOwnedHallWithDetails_ReturnsOwnedHallWithPeriodsAndPhotos()
    {
        await using var context = CreateContext();
        var ownerId = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        var hall = new Hall { Id = hallId, Name = "Grand Hall", OwnerId = ownerId, Status = HallStatus.Approved };
        context.Halls.Add(hall);
        context.HallImages.AddRange(
            new HallImage { HallId = hallId, Url = "a.jpg", DisplayOrder = 0 },
            new HallImage { HallId = hallId, Url = "b.jpg", DisplayOrder = 1, IsDeleted = true });
        context.HallBookingPeriods.AddRange(
            new HallBookingPeriod { HallId = hallId, Type = BookingPeriodType.FirstPeriod, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(15, 0) },
            new HallBookingPeriod { HallId = hallId, Type = BookingPeriodType.SecondPeriod, StartTime = new TimeOnly(16, 0), EndTime = new TimeOnly(23, 0) });
        await context.SaveChangesAsync();

        var repository = new OwnerDashboardRepository(context);

        var result = await repository.GetOwnedHallWithDetailsAsync(hallId, ownerId);

        Assert.NotNull(result);
        Assert.Equal(hallId, result.Id);
        Assert.Equal(2, result.BookingPeriods.Count);
        Assert.Equal(2, result.Images.Count);
    }

    [Fact]
    public async Task GetOwnedHallWithDetails_AnotherOwnersHall_ReturnsNull()
    {
        await using var context = CreateContext();
        var ownerId = Guid.NewGuid().ToString();
        var otherId = Guid.NewGuid().ToString();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Other's Hall", OwnerId = otherId, Status = HallStatus.Approved };
        context.Halls.Add(hall);
        await context.SaveChangesAsync();

        var repository = new OwnerDashboardRepository(context);

        var result = await repository.GetOwnedHallWithDetailsAsync(hall.Id, ownerId);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetOwnedHallWithDetails_DeletedHall_ReturnsNull()
    {
        await using var context = CreateContext();
        var ownerId = Guid.NewGuid().ToString();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Deleted Hall", OwnerId = ownerId, Status = HallStatus.Approved, IsDeleted = true };
        context.Halls.Add(hall);
        await context.SaveChangesAsync();

        var repository = new OwnerDashboardRepository(context);

        var result = await repository.GetOwnedHallWithDetailsAsync(hall.Id, ownerId);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetOwnedHallForUpdate_ReturnsTrackedAggregateThatPersistsChanges()
    {
        await using var context = CreateContext();
        var ownerId = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        var hall = new Hall { Id = hallId, Name = "Grand Hall", OwnerId = ownerId, Status = HallStatus.Approved };
        context.Halls.Add(hall);
        context.HallImages.Add(new HallImage { HallId = hallId, Url = "a.jpg", DisplayOrder = 0 });
        context.HallBookingPeriods.Add(new HallBookingPeriod
        {
            HallId = hallId,
            Type = BookingPeriodType.FirstPeriod,
            StartTime = new TimeOnly(9, 0),
            EndTime = new TimeOnly(15, 0)
        });
        await context.SaveChangesAsync();

        var repository = new OwnerDashboardRepository(context);

        var result = await repository.GetOwnedHallForUpdateAsync(hallId, ownerId);
        Assert.NotNull(result);

        result.Name = "Grand Hall Renamed";
        result.Images.Single().IsDeleted = true;
        await context.SaveChangesAsync();

        Assert.Equal("Grand Hall Renamed", context.Halls.AsNoTracking().Single(item => item.Id == hallId).Name);
        Assert.True(context.HallImages.AsNoTracking().Single(image => image.HallId == hallId).IsDeleted);
    }

    [Fact]
    public async Task GetOwnedHall_ReturnsOwnedHallWithSubscriptionState()
    {
        await using var context = CreateContext();
        var ownerId = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        var cycleEnd = new DateOnly(2026, 10, 1);
        context.Halls.Add(new Hall
        {
            Id = hallId,
            Name = "Grand Hall",
            OwnerId = ownerId,
            Status = HallStatus.Approved,
            SubscriptionCycleEnd = cycleEnd,
            IsAdminLocked = true
        });
        await context.SaveChangesAsync();

        var repository = new OwnerDashboardRepository(context);

        var result = await repository.GetOwnedHallAsync(hallId, ownerId);

        Assert.NotNull(result);
        Assert.Equal(hallId, result!.Id);
        Assert.Equal(cycleEnd, result.SubscriptionCycleEnd);
        Assert.True(result.IsAdminLocked);
    }

    [Fact]
    public async Task GetOwnedHall_AnotherOwnersHall_ReturnsNull()
    {
        await using var context = CreateContext();
        var ownerId = Guid.NewGuid().ToString();
        var otherId = Guid.NewGuid().ToString();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Other's Hall", OwnerId = otherId, Status = HallStatus.Approved };
        context.Halls.Add(hall);
        await context.SaveChangesAsync();

        var repository = new OwnerDashboardRepository(context);

        var result = await repository.GetOwnedHallAsync(hall.Id, ownerId);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetOwnedHall_DeletedHall_ReturnsNull()
    {
        await using var context = CreateContext();
        var ownerId = Guid.NewGuid().ToString();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Deleted Hall", OwnerId = ownerId, Status = HallStatus.Approved, IsDeleted = true };
        context.Halls.Add(hall);
        await context.SaveChangesAsync();

        var repository = new OwnerDashboardRepository(context);

        var result = await repository.GetOwnedHallAsync(hall.Id, ownerId);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetOwnedHall_NonexistentHall_ReturnsNull()
    {
        await using var context = CreateContext();

        var repository = new OwnerDashboardRepository(context);

        var result = await repository.GetOwnedHallAsync(Guid.NewGuid(), Guid.NewGuid().ToString());

        Assert.Null(result);
    }

    [Fact]
    public async Task GetBookingRequests_AnotherOwnersHall_ReturnsNull()
    {
        await using var context = CreateContext();
        var ownerId = Guid.NewGuid().ToString();
        var otherId = Guid.NewGuid().ToString();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Other's Hall", OwnerId = otherId, Status = HallStatus.Approved };
        context.Halls.Add(hall);
        await context.SaveChangesAsync();

        var repository = new OwnerDashboardRepository(context);

        var result = await repository.GetBookingRequestsAsync(hall.Id, ownerId);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetBookingRequests_DeletedHall_ReturnsNull()
    {
        await using var context = CreateContext();
        var ownerId = Guid.NewGuid().ToString();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Deleted Hall", OwnerId = ownerId, Status = HallStatus.Approved, IsDeleted = true };
        context.Halls.Add(hall);
        await context.SaveChangesAsync();

        var repository = new OwnerDashboardRepository(context);

        var result = await repository.GetBookingRequestsAsync(hall.Id, ownerId);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetBookingRequests_OwnedHallWithoutRequests_ReturnsEmptyList()
    {
        await using var context = CreateContext();
        var ownerId = Guid.NewGuid().ToString();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Grand Hall", OwnerId = ownerId, Status = HallStatus.Approved };
        context.Halls.Add(hall);
        await context.SaveChangesAsync();

        var repository = new OwnerDashboardRepository(context);

        var result = await repository.GetBookingRequestsAsync(hall.Id, ownerId);

        Assert.NotNull(result);
        Assert.Empty(result!);
    }

    [Fact]
    public async Task GetBookingRequests_ResolvesRequesterNameServerSide()
    {
        await using var context = CreateContext();
        var ownerId = Guid.NewGuid().ToString();
        var requesterId = Guid.NewGuid().ToString();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Grand Hall", OwnerId = ownerId, Status = HallStatus.Approved };
        var requester = new ApplicationUser { Id = requesterId, UserName = "requester", FullName = "Mahmoud Salah" };
        context.Halls.Add(hall);
        context.Users.Add(requester);
        context.Bookings.Add(new Booking
        {
            HallId = hall.Id,
            RequesterUserId = requesterId,
            Date = new DateOnly(2027, 6, 1),
            Period = BookingPeriodType.FirstPeriod
        });
        await context.SaveChangesAsync();

        var repository = new OwnerDashboardRepository(context);

        var result = await repository.GetBookingRequestsAsync(hall.Id, ownerId);

        var item = Assert.Single(result!);
        Assert.Equal(requesterId, item.RequesterUserId);
        Assert.Equal("Mahmoud Salah", item.RequesterName);
        Assert.Equal(new DateOnly(2027, 6, 1), item.RequestedDate);
        Assert.Equal(BookingPeriodType.FirstPeriod, item.RequestedPeriod);
        Assert.Equal(BookingStatus.Pending, item.Status);
    }

    [Fact]
    public async Task GetBookingRequests_CompetingRequests_AreAllReturned()
    {
        await using var context = CreateContext();
        var ownerId = Guid.NewGuid().ToString();
        var firstId = Guid.NewGuid().ToString();
        var secondId = Guid.NewGuid().ToString();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Grand Hall", OwnerId = ownerId, Status = HallStatus.Approved };
        context.Halls.Add(hall);
        context.Users.AddRange(
            new ApplicationUser { Id = firstId, UserName = "first", FullName = "First Requester" },
            new ApplicationUser { Id = secondId, UserName = "second", FullName = "Second Requester" });
        context.Bookings.AddRange(
            new Booking { HallId = hall.Id, RequesterUserId = firstId, Date = new DateOnly(2027, 6, 1), Period = BookingPeriodType.FirstPeriod },
            new Booking { HallId = hall.Id, RequesterUserId = secondId, Date = new DateOnly(2027, 6, 1), Period = BookingPeriodType.FirstPeriod });
        await context.SaveChangesAsync();

        var repository = new OwnerDashboardRepository(context);

        var result = await repository.GetBookingRequestsAsync(hall.Id, ownerId);

        Assert.Equal(2, result!.Count);
        Assert.Contains(result, item => item.RequesterUserId == firstId && item.RequesterName == "First Requester");
        Assert.Contains(result, item => item.RequesterUserId == secondId && item.RequesterName == "Second Requester");
    }

    [Fact]
    public async Task GetBookingRequests_ExcludesNonPendingAndOtherHallsRequests()
    {
        await using var context = CreateContext();
        var ownerId = Guid.NewGuid().ToString();
        var requesterId = Guid.NewGuid().ToString();
        var hallA = new Hall { Id = Guid.NewGuid(), Name = "Hall A", OwnerId = ownerId, Status = HallStatus.Approved };
        var hallB = new Hall { Id = Guid.NewGuid(), Name = "Hall B", OwnerId = ownerId, Status = HallStatus.Approved };
        context.Halls.AddRange(hallA, hallB);
        context.Users.Add(new ApplicationUser { Id = requesterId, UserName = "requester", FullName = "Pending Only" });
        context.Bookings.AddRange(
            new Booking { HallId = hallA.Id, RequesterUserId = requesterId, Date = new DateOnly(2027, 6, 1), Period = BookingPeriodType.FirstPeriod, Status = BookingStatus.Pending },
            new Booking { HallId = hallA.Id, RequesterUserId = requesterId, Date = new DateOnly(2027, 6, 1), Period = BookingPeriodType.SecondPeriod, Status = BookingStatus.Accepted },
            new Booking { HallId = hallA.Id, RequesterUserId = requesterId, Date = new DateOnly(2027, 6, 5), Period = BookingPeriodType.FirstPeriod, Status = BookingStatus.Rejected },
            new Booking { HallId = hallB.Id, RequesterUserId = requesterId, Date = new DateOnly(2027, 6, 1), Period = BookingPeriodType.FirstPeriod, Status = BookingStatus.Pending });
        await context.SaveChangesAsync();

        var repository = new OwnerDashboardRepository(context);

        var result = await repository.GetBookingRequestsAsync(hallA.Id, ownerId);

        var item = Assert.Single(result!);
        Assert.Equal(BookingStatus.Pending, item.Status);
        Assert.Equal(BookingPeriodType.FirstPeriod, item.RequestedPeriod);
    }

    [Fact]
    public async Task GetBookingRequests_IsDeterministicallyOrdered()
    {
        await using var context = CreateContext();
        var ownerId = Guid.NewGuid().ToString();
        var requesterId = Guid.NewGuid().ToString();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Grand Hall", OwnerId = ownerId, Status = HallStatus.Approved };
        context.Halls.Add(hall);
        context.Users.Add(new ApplicationUser { Id = requesterId, UserName = "requester", FullName = "Ordered" });
        context.Bookings.AddRange(
            new Booking { HallId = hall.Id, RequesterUserId = requesterId, Date = new DateOnly(2027, 7, 2), Period = BookingPeriodType.FirstPeriod },
            new Booking { HallId = hall.Id, RequesterUserId = requesterId, Date = new DateOnly(2027, 6, 1), Period = BookingPeriodType.FirstPeriod },
            new Booking { HallId = hall.Id, RequesterUserId = requesterId, Date = new DateOnly(2027, 6, 1), Period = BookingPeriodType.SecondPeriod });
        await context.SaveChangesAsync();

        var repository = new OwnerDashboardRepository(context);

        var result = await repository.GetBookingRequestsAsync(hall.Id, ownerId);

        Assert.Collection(
            result!,
            item => Assert.Equal(new DateOnly(2027, 6, 1), item.RequestedDate),
            item => Assert.Equal(new DateOnly(2027, 6, 1), item.RequestedDate),
            item => Assert.Equal(new DateOnly(2027, 7, 2), item.RequestedDate));
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }
}