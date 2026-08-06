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
        var approved = new Hall { Id = Guid.NewGuid(), Name = "Approved", Status = HallStatus.Approved, CreatedAt = FixedNow.AddDays(-1) };
        var pending = new Hall { Id = Guid.NewGuid(), Name = "Pending", Status = HallStatus.PendingReview, CreatedAt = FixedNow };
        var rejected = new Hall { Id = Guid.NewGuid(), Name = "Rejected", Status = HallStatus.Rejected, CreatedAt = FixedNow };
        var deleted = new Hall { Id = Guid.NewGuid(), Name = "Deleted", Status = HallStatus.Approved, IsDeleted = true, CreatedAt = FixedNow };
        context.Halls.AddRange(approved, pending, rejected, deleted);
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetApprovedHallsAsync(10);

        Assert.Single(result);
        Assert.Equal(approved.Id, result[0].Id);
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
                Status = HallStatus.Approved,
                CreatedAt = FixedNow.AddMinutes(-index)
            });
        }

        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.GetApprovedHallsAsync(3);

        Assert.Equal(3, result.Count);
    }

    [Fact]
    public async Task GetBookingPeriodsAsync_FiltersByHallIds()
    {
        await using var context = CreateContext();
        var firstHall = new Hall { Id = Guid.NewGuid(), Name = "First", Status = HallStatus.Approved };
        var secondHall = new Hall { Id = Guid.NewGuid(), Name = "Second", Status = HallStatus.Approved };
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
        var hall = new Hall { Id = Guid.NewGuid(), Name = "Hall", Status = HallStatus.Approved };
        var otherHall = new Hall { Id = Guid.NewGuid(), Name = "Other", Status = HallStatus.Approved };
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

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }
}
