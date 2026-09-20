using Microsoft.EntityFrameworkCore;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Persistence;

public class HallRepositoryShould
{
    private static readonly DateTimeOffset FixedNow = new(2026, 8, 6, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task GetApprovedHallsAsync_ReturnsOnlyApprovedAndNotDeletedHalls()
    {
        await using var context = CreateContext();
        var approved = new Hall { Id = Guid.NewGuid(), Name = "Approved", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, CreatedAt = FixedNow.AddDays(-1) };
        var pending = new Hall { Id = Guid.NewGuid(), Name = "Pending", Status = HallStatus.PendingReview, CreatedAt = FixedNow };
        var rejected = new Hall { Id = Guid.NewGuid(), Name = "Rejected", Status = HallStatus.Rejected, CreatedAt = FixedNow };
        var deleted = new Hall { Id = Guid.NewGuid(), Name = "Deleted", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, IsDeleted = true, CreatedAt = FixedNow };
        context.Halls.AddRange(approved, pending, rejected, deleted);
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetApprovedHallsAsync(10);

        Assert.Single(result);
        Assert.Equal(approved.Id, result[0].Id);
    }

    // --- US-ADMIN-10 / US-OWNER-31: a hall is publicly visible only when it is
    // Approved AND Paid; an Approved hall awaiting its payment receipt stays hidden. ---

    [Fact]
    public async Task GetApprovedHallsAsync_ApprovedButUnpaidHall_IsHiddenFromPublicList()
    {
        await using var context = CreateContext();
        var paid = new Hall { Id = Guid.NewGuid(), Name = "Paid Hall", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, CreatedAt = FixedNow.AddDays(-1) };
        var unpaid = new Hall { Id = Guid.NewGuid(), Name = "Unpaid Hall", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Unpaid, CreatedAt = FixedNow };
        context.Halls.AddRange(paid, unpaid);
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetApprovedHallsAsync(10);
        var searchResult = await repository.SearchApprovedHallsAsync(null, null, null, null, null, 0, 10);
        var searchCount = await repository.SearchApprovedHallsCountAsync(null, null, null, null, null);

        Assert.Single(result);
        Assert.Equal(paid.Id, result[0].Id);
        Assert.Single(searchResult);
        Assert.Equal(paid.Id, searchResult[0].Id);
        Assert.Equal(1, searchCount);
    }

    [Fact]
    public async Task GetApprovedHallsByRegionAsync_ApprovedButUnpaidHall_IsHidden()
    {
        await using var context = CreateContext();
        context.Halls.AddRange(
            new Hall { Id = Guid.NewGuid(), Name = "Paid Hall", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, Region = HallRegion.Gaza, CreatedAt = FixedNow },
            new Hall { Id = Guid.NewGuid(), Name = "Unpaid Hall", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Unpaid, Region = HallRegion.Gaza, CreatedAt = FixedNow });
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetApprovedHallsByRegionAsync(HallRegion.Gaza, 10);

        var item = Assert.Single(result);
        Assert.Equal("Paid Hall", item.Name);
    }

    [Fact]
    public async Task GetApprovedHallsAsync_LimitsResultCount()
    {
        await using var context = CreateContext();
        for (var index = 0; index < 5; index++)
        {
            context.Halls.Add(new Hall
            {
                Id = Guid.NewGuid(),
                Name = $"Hall {index}",
                Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid,
                CreatedAt = FixedNow.AddMinutes(-index)
            });
        }

        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetApprovedHallsAsync(3);

        Assert.Equal(3, result.Count);
    }

    [Fact]
    public async Task GetApprovedHallsByRegionAsync_ReturnsOnlyHallsInRequestedRegion()
    {
        await using var context = CreateContext();
        context.Halls.AddRange(
            new Hall { Id = Guid.NewGuid(), Name = "Gaza Hall", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, Region = HallRegion.Gaza, CreatedAt = FixedNow },
            new Hall { Id = Guid.NewGuid(), Name = "North Hall", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, Region = HallRegion.NorthGaza, CreatedAt = FixedNow },
            new Hall { Id = Guid.NewGuid(), Name = "Middle Hall", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, Region = HallRegion.MiddleArea, CreatedAt = FixedNow },
            new Hall { Id = Guid.NewGuid(), Name = "South Hall", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, Region = HallRegion.SouthGaza, CreatedAt = FixedNow });
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetApprovedHallsByRegionAsync(HallRegion.Gaza, 10);

        var item = Assert.Single(result);
        Assert.Equal("Gaza Hall", item.Name);
    }

    [Fact]
    public async Task GetApprovedHallsByRegionAsync_ReturnsEmptyWhenRegionHasNoHalls()
    {
        await using var context = CreateContext();
        context.Halls.Add(new Hall
        {
            Id = Guid.NewGuid(),
            Name = "Gaza Hall",
            Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid,
            Region = HallRegion.Gaza,
            CreatedAt = FixedNow
        });
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetApprovedHallsByRegionAsync(HallRegion.SouthGaza, 10);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetApprovedHallsByRegionAsync_ReturnsOnlyApprovedAndNotDeletedHalls()
    {
        await using var context = CreateContext();
        context.Halls.AddRange(
            new Hall { Id = Guid.NewGuid(), Name = "Approved", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, Region = HallRegion.Gaza, CreatedAt = FixedNow.AddDays(-1) },
            new Hall { Id = Guid.NewGuid(), Name = "Pending", Status = HallStatus.PendingReview, Region = HallRegion.Gaza, CreatedAt = FixedNow },
            new Hall { Id = Guid.NewGuid(), Name = "Rejected", Status = HallStatus.Rejected, Region = HallRegion.Gaza, CreatedAt = FixedNow },
            new Hall { Id = Guid.NewGuid(), Name = "Deleted", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, IsDeleted = true, Region = HallRegion.Gaza, CreatedAt = FixedNow });
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetApprovedHallsByRegionAsync(HallRegion.Gaza, 10);

        Assert.Single(result);
        Assert.Equal("Approved", result[0].Name);
    }

    [Fact]
    public async Task GetApprovedHallsByRegionAsync_LimitsResultCount()
    {
        await using var context = CreateContext();
        for (var index = 0; index < 5; index++)
        {
            context.Halls.Add(new Hall
            {
                Id = Guid.NewGuid(),
                Name = $"Hall {index}",
                Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid,
                Region = HallRegion.Gaza,
                CreatedAt = FixedNow.AddMinutes(-index)
            });
        }

        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetApprovedHallsByRegionAsync(HallRegion.Gaza, 3);

        Assert.Equal(3, result.Count);
    }

    [Fact]
    public async Task GetApprovedHallsByRegionAsync_ComposesFilterInQueryProviderBeforeMaterialization()
    {
        await using var context = CreateContext();
        context.Halls.AddRange(
            new Hall { Id = Guid.NewGuid(), Name = "Gaza Hall", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, Region = HallRegion.Gaza, CreatedAt = FixedNow },
            new Hall { Id = Guid.NewGuid(), Name = "North Hall", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, Region = HallRegion.NorthGaza, CreatedAt = FixedNow });
        await context.SaveChangesAsync();

        var query = context.Halls
            .AsNoTracking()
            .Where(hall => hall.Status == HallStatus.Approved && !hall.IsDeleted)
            .Where(hall => hall.Region == HallRegion.Gaza);

        Assert.Contains("Region", query.Expression.ToString());

        var repository = new HallRepository(context);
        var result = await repository.GetApprovedHallsByRegionAsync(HallRegion.Gaza, 10);

        Assert.Single(result);
        Assert.Equal("Gaza Hall", result[0].Name);
    }

    [Fact]
    public async Task GetBookingPeriodsAsync_FiltersByHallIds()
    {
        await using var context = CreateContext();
        var firstHall = new Hall { Id = Guid.NewGuid(), Name = "First", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid };
        var secondHall = new Hall { Id = Guid.NewGuid(), Name = "Second", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid };
        context.Halls.AddRange(firstHall, secondHall);
        context.HallBookingPeriods.AddRange(
            new HallBookingPeriod { HallId = firstHall.Id, Type = BookingPeriodType.FirstPeriod, StartTime = new TimeOnly(12, 0), EndTime = new TimeOnly(15, 0) },
            new HallBookingPeriod { HallId = secondHall.Id, Type = BookingPeriodType.FirstPeriod, StartTime = new TimeOnly(12, 0), EndTime = new TimeOnly(15, 0) });
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetBookingPeriodsAsync([firstHall.Id]);

        Assert.Single(result);
        Assert.Equal(firstHall.Id, result[0].HallId);
    }

    [Fact]
    public async Task GetAvailabilityAsync_FiltersByHallIdsAndDateRange()
    {
        await using var context = CreateContext();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Hall", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid };
        var otherHall = new Hall { Id = Guid.NewGuid(), Name = "Other", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid };
        context.Halls.AddRange(hall, otherHall);
        context.HallAvailabilities.AddRange(
            new HallAvailability { HallId = hall.Id, Date = new DateOnly(2026, 8, 6), PeriodType = BookingPeriodType.FirstPeriod, Status = AvailabilityStatus.Booked },
            new HallAvailability { HallId = hall.Id, Date = new DateOnly(2026, 9, 1), PeriodType = BookingPeriodType.FirstPeriod, Status = AvailabilityStatus.Booked },
            new HallAvailability { HallId = otherHall.Id, Date = new DateOnly(2026, 8, 6), PeriodType = BookingPeriodType.FirstPeriod, Status = AvailabilityStatus.Booked });
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetAvailabilityAsync(
            [hall.Id],
            new DateOnly(2026, 8, 1),
            new DateOnly(2026, 8, 31));

        Assert.Single(result);
        Assert.Equal(hall.Id, result[0].HallId);
        Assert.Equal(new DateOnly(2026, 8, 6), result[0].Date);
    }

    [Fact]
    public async Task GetAvailabilityAsync_ReturnsEmptyForEmptyHallIds()
    {
        await using var context = CreateContext();

        var repository = new HallRepository(context);

        var result = await repository.GetAvailabilityAsync([], new DateOnly(2026, 8, 1), new DateOnly(2026, 8, 31));

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetHallByIdAsync_ReturnsHallById()
    {
        await using var context = CreateContext();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Hall", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid };
        context.Halls.Add(hall);
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetHallByIdAsync(hall.Id);

        Assert.NotNull(result);
        Assert.Equal(hall.Id, result.Id);
    }

    [Fact]
    public async Task GetHallByIdAsync_ReturnsNullWhenHallDoesNotExist()
    {
        await using var context = CreateContext();

        var repository = new HallRepository(context);

        var result = await repository.GetHallByIdAsync(Guid.NewGuid());

        Assert.Null(result);
    }

    [Fact]
    public async Task GetHallImagesAsync_ReturnsOnlyImagesForHall()
    {
        await using var context = CreateContext();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Hall", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid };
        var otherHall = new Hall { Id = Guid.NewGuid(), Name = "Other", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid };
        context.Halls.AddRange(hall, otherHall);
        context.HallImages.AddRange(
            new HallImage { HallId = hall.Id, Url = "hall.jpg", DisplayOrder = 1 },
            new HallImage { HallId = otherHall.Id, Url = "other.jpg", DisplayOrder = 1 });
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetHallImagesAsync(hall.Id);

        var image = Assert.Single(result);
        Assert.Equal("hall.jpg", image.Url);
    }

    [Fact]
    public async Task GetHallImagesAsync_OrdersByDisplayOrder()
    {
        await using var context = CreateContext();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Hall", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid };
        context.Halls.Add(hall);
        context.HallImages.AddRange(
            new HallImage { HallId = hall.Id, Url = "second.jpg", DisplayOrder = 2, CreatedAt = FixedNow.AddMinutes(-1) },
            new HallImage { HallId = hall.Id, Url = "first.jpg", DisplayOrder = 1, CreatedAt = FixedNow });
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetHallImagesAsync(hall.Id);

        Assert.Collection(
            result,
            image => Assert.Equal("first.jpg", image.Url),
            image => Assert.Equal("second.jpg", image.Url));
    }

    [Fact]
    public async Task GetHallImagesAsync_ExcludesDeletedImages()
    {
        await using var context = CreateContext();
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Hall", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid };
        context.Halls.Add(hall);
        context.HallImages.AddRange(
            new HallImage { HallId = hall.Id, Url = "visible.jpg", DisplayOrder = 1 },
            new HallImage { HallId = hall.Id, Url = "hidden.jpg", DisplayOrder = 2, IsDeleted = true });
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetHallImagesAsync(hall.Id);

        var image = Assert.Single(result);
        Assert.Equal("visible.jpg", image.Url);
    }

    [Fact]
    public async Task GetApprovedHallsPaginatedAsync_ReturnsCorrectPage()
    {
        await using var context = CreateContext();
        for (var index = 0; index < 5; index++)
        {
            context.Halls.Add(new Hall
            {
                Id = Guid.NewGuid(),
                Name = $"Hall {index}",
                Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid,
                CreatedAt = FixedNow.AddMinutes(-index)
            });
        }

        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetApprovedHallsPaginatedAsync(skip: 0, take: 3);

        Assert.Equal(3, result.Count);
        Assert.Equal("Hall 0", result[0].Name);
        Assert.Equal("Hall 1", result[1].Name);
        Assert.Equal("Hall 2", result[2].Name);
    }

    [Fact]
    public async Task GetApprovedHallsPaginatedAsync_ReturnsSecondPage()
    {
        await using var context = CreateContext();
        for (var index = 0; index < 5; index++)
        {
            context.Halls.Add(new Hall
            {
                Id = Guid.NewGuid(),
                Name = $"Hall {index}",
                Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid,
                CreatedAt = FixedNow.AddMinutes(-index)
            });
        }

        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetApprovedHallsPaginatedAsync(skip: 3, take: 3);

        Assert.Equal(2, result.Count);
        Assert.Equal("Hall 3", result[0].Name);
        Assert.Equal("Hall 4", result[1].Name);
    }

    [Fact]
    public async Task GetApprovedHallsPaginatedAsync_SkipsDeletedAndUnapproved()
    {
        await using var context = CreateContext();
        context.Halls.AddRange(
            new Hall { Id = Guid.NewGuid(), Name = "Approved 1", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, CreatedAt = FixedNow.AddMinutes(-1) },
            new Hall { Id = Guid.NewGuid(), Name = "Approved 2", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, CreatedAt = FixedNow.AddMinutes(-2) },
            new Hall { Id = Guid.NewGuid(), Name = "Pending", Status = HallStatus.PendingReview, CreatedAt = FixedNow },
            new Hall { Id = Guid.NewGuid(), Name = "Deleted", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, IsDeleted = true, CreatedAt = FixedNow });
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetApprovedHallsPaginatedAsync(skip: 0, take: 10);

        Assert.Equal(2, result.Count);
        Assert.Equal("Approved 1", result[0].Name);
        Assert.Equal("Approved 2", result[1].Name);
    }

    [Fact]
    public async Task GetApprovedHallsPaginatedAsync_ReturnsEmptyForOversizedSkip()
    {
        await using var context = CreateContext();
        context.Halls.Add(new Hall
        {
            Id = Guid.NewGuid(),
            Name = "Only Hall",
            Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid,
            CreatedAt = FixedNow
        });
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetApprovedHallsPaginatedAsync(skip: 100, take: 10);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetApprovedHallsCountAsync_ReturnsOnlyApprovedAndNotDeleted()
    {
        await using var context = CreateContext();
        context.Halls.AddRange(
            new Hall { Id = Guid.NewGuid(), Name = "Approved", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, CreatedAt = FixedNow },
            new Hall { Id = Guid.NewGuid(), Name = "Pending", Status = HallStatus.PendingReview, CreatedAt = FixedNow },
            new Hall { Id = Guid.NewGuid(), Name = "Deleted", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, IsDeleted = true, CreatedAt = FixedNow });
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetApprovedHallsCountAsync();

        Assert.Equal(1, result);
    }

    [Fact]
    public async Task GetApprovedHallsCountAsync_ReturnsZeroWhenNoHalls()
    {
        await using var context = CreateContext();

        var repository = new HallRepository(context);

        var result = await repository.GetApprovedHallsCountAsync();

        Assert.Equal(0, result);
    }

    [Fact]
    public async Task GetApprovedHallsAsync_ExcludesAdminLockedAndSystemLockedHalls()
    {
        await using var context = CreateContext();
        context.Halls.AddRange(
            new Hall { Id = Guid.NewGuid(), Name = "Visible", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, CreatedAt = FixedNow.AddDays(-1) },
            new Hall { Id = Guid.NewGuid(), Name = "Admin Locked", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, IsAdminLocked = true, CreatedAt = FixedNow },
            new Hall { Id = Guid.NewGuid(), Name = "System Locked", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, SystemLocked = true, CreatedAt = FixedNow });
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetApprovedHallsAsync(10);

        Assert.Single(result);
        Assert.Equal("Visible", result[0].Name);
    }

    [Fact]
    public async Task GetApprovedHallsByRegionAsync_ExcludesLockedHalls()
    {
        await using var context = CreateContext();
        context.Halls.AddRange(
            new Hall { Id = Guid.NewGuid(), Name = "Visible", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, Region = HallRegion.Gaza, CreatedAt = FixedNow.AddDays(-1) },
            new Hall { Id = Guid.NewGuid(), Name = "Admin Locked", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, Region = HallRegion.Gaza, IsAdminLocked = true, CreatedAt = FixedNow },
            new Hall { Id = Guid.NewGuid(), Name = "System Locked", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, Region = HallRegion.Gaza, SystemLocked = true, CreatedAt = FixedNow });
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetApprovedHallsByRegionAsync(HallRegion.Gaza, 10);

        Assert.Single(result);
        Assert.Equal("Visible", result[0].Name);
    }

    [Fact]
    public async Task GetApprovedHallsCountAsync_ExcludesLockedHalls()
    {
        await using var context = CreateContext();
        context.Halls.AddRange(
            new Hall { Id = Guid.NewGuid(), Name = "Visible", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, CreatedAt = FixedNow.AddDays(-1) },
            new Hall { Id = Guid.NewGuid(), Name = "Admin Locked", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, IsAdminLocked = true, CreatedAt = FixedNow },
            new Hall { Id = Guid.NewGuid(), Name = "System Locked", Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, SystemLocked = true, CreatedAt = FixedNow });
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetApprovedHallsCountAsync();

        Assert.Equal(1, result);
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }
}
