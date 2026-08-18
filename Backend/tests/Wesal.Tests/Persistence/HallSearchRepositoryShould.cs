using Microsoft.EntityFrameworkCore;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Persistence;

public class HallSearchRepositoryShould
{
    private static readonly DateTimeOffset FixedNow = new(2026, 8, 6, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task SearchApprovedHallsAsync_ReturnsAllApprovedHallsWhenNoFiltersProvided()
    {
        await using var context = CreateContext();
        context.Halls.AddRange(
            CreateHall("Alpha Hall"),
            CreateHall("Beta Hall"));
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.SearchApprovedHallsAsync(null, null, null, null, null, 0, 20);

        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task SearchApprovedHallsAsync_FiltersByHallName()
    {
        await using var context = CreateContext();
        context.Halls.AddRange(
            CreateHall("Royal Hall"),
            CreateHall("Al-Nasr Hall"),
            CreateHall("Royal Garden"));
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.SearchApprovedHallsAsync("Royal", null, null, null, null, 0, 20);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, hall => hall.Name == "Royal Hall");
        Assert.Contains(result, hall => hall.Name == "Royal Garden");
    }

    [Fact]
    public async Task SearchApprovedHallsAsync_FiltersByRegion()
    {
        await using var context = CreateContext();
        context.Halls.AddRange(
            CreateHall("Gaza Hall", region: HallRegion.Gaza),
            CreateHall("North Hall", region: HallRegion.NorthGaza),
            CreateHall("South Hall", region: HallRegion.SouthGaza));
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.SearchApprovedHallsAsync(null, HallRegion.Gaza, null, null, null, 0, 20);

        Assert.Single(result);
        Assert.Equal("Gaza Hall", result[0].Name);
    }

    [Fact]
    public async Task SearchApprovedHallsAsync_FiltersByAreaInsideAddress()
    {
        await using var context = CreateContext();
        context.Halls.AddRange(
            CreateHall("First Hall", address: "Sheikh Radwan Street, Gaza"),
            CreateHall("Second Hall", address: "Al-Nasr Street, Gaza"),
            CreateHall("Third Hall", address: "Sheikh Radwan, North Gaza"));
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.SearchApprovedHallsAsync(null, null, "Sheikh Radwan", null, null, 0, 20);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, hall => hall.Name == "First Hall");
        Assert.Contains(result, hall => hall.Name == "Third Hall");
    }

    [Fact]
    public async Task SearchApprovedHallsAsync_ExcludesHallsBookedOnSelectedDateAndPeriod()
    {
        await using var context = CreateContext();
        var availableHall = CreateHall("Available Hall");
        var bookedHall = CreateHall("Booked Hall");
        var otherPeriodHall = CreateHall("Other Period Hall");
        context.Halls.AddRange(availableHall, bookedHall, otherPeriodHall);
        context.HallAvailabilities.AddRange(
            new HallAvailability
            {
                HallId = bookedHall.Id,
                Date = new DateOnly(2026, 8, 10),
                PeriodType = BookingPeriodType.FirstPeriod,
                Status = AvailabilityStatus.Booked
            },
            new HallAvailability
            {
                HallId = otherPeriodHall.Id,
                Date = new DateOnly(2026, 8, 10),
                PeriodType = BookingPeriodType.SecondPeriod,
                Status = AvailabilityStatus.Booked
            });
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.SearchApprovedHallsAsync(
            null,
            null,
            null,
            new DateOnly(2026, 8, 10),
            BookingPeriodType.FirstPeriod,
            0,
            20);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, hall => hall.Id == availableHall.Id);
        Assert.Contains(result, hall => hall.Id == otherPeriodHall.Id);
        Assert.DoesNotContain(result, hall => hall.Id == bookedHall.Id);
    }

    [Fact]
    public async Task SearchApprovedHallsAsync_IgnoresDateFilterWhenPeriodNotProvided()
    {
        await using var context = CreateContext();
        var bookedHall = CreateHall("Booked Hall");
        context.Halls.Add(bookedHall);
        context.HallAvailabilities.Add(new HallAvailability
        {
            HallId = bookedHall.Id,
            Date = new DateOnly(2026, 8, 10),
            PeriodType = BookingPeriodType.FirstPeriod,
            Status = AvailabilityStatus.Booked
        });
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.SearchApprovedHallsAsync(
            null,
            null,
            null,
            new DateOnly(2026, 8, 10),
            null,
            0,
            20);

        Assert.Equal(bookedHall.Id, Assert.Single(result).Id);
    }

    [Fact]
    public async Task SearchApprovedHallsAsync_ReturnsOnlyApprovedAndNotDeletedHalls()
    {
        await using var context = CreateContext();
        context.Halls.AddRange(
            CreateHall("Approved Hall"),
            CreateHall("Pending Hall", status: HallStatus.PendingReview),
            CreateHall("Rejected Hall", status: HallStatus.Rejected),
            CreateHall("Deleted Hall", isDeleted: true));
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.SearchApprovedHallsAsync(null, null, null, null, null, 0, 20);

        Assert.Equal("Approved Hall", Assert.Single(result).Name);
    }

    [Fact]
    public async Task SearchApprovedHallsAsync_CombinesFiltersUsingAndLogic()
    {
        await using var context = CreateContext();
        var matchingHall = CreateHall("Royal Hall", region: HallRegion.Gaza, address: "Royal Street, Gaza");
        context.Halls.AddRange(
            matchingHall,
            CreateHall("Royal Hall", region: HallRegion.NorthGaza, address: "Royal Street, Gaza"),
            CreateHall("Royal Hall", region: HallRegion.Gaza, address: "Other Street, Gaza"));
        var bookedHall = CreateHall("Royal Hall", region: HallRegion.Gaza, address: "Royal Street, Gaza");
        context.Halls.Add(bookedHall);
        context.HallAvailabilities.Add(new HallAvailability
        {
            HallId = bookedHall.Id,
            Date = new DateOnly(2026, 8, 10),
            PeriodType = BookingPeriodType.FirstPeriod,
            Status = AvailabilityStatus.Booked
        });
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.SearchApprovedHallsAsync(
            "Royal",
            HallRegion.Gaza,
            "Royal Street",
            new DateOnly(2026, 8, 10),
            BookingPeriodType.FirstPeriod,
            0,
            20);

        Assert.Equal(matchingHall.Id, Assert.Single(result).Id);
    }

    [Fact]
    public async Task SearchApprovedHallsAsync_ReturnsEmptyResultWhenNoHallMatches()
    {
        await using var context = CreateContext();
        context.Halls.Add(CreateHall("Royal Hall"));
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.SearchApprovedHallsAsync("Nonexistent", null, null, null, null, 0, 20);

        Assert.Empty(result);
    }

    [Fact]
    public async Task SearchApprovedHallsAsync_PagesResultsInDatabase()
    {
        await using var context = CreateContext();
        for (var index = 0; index < 5; index++)
        {
            context.Halls.Add(CreateHall($"Hall {index}", createdAt: FixedNow.AddMinutes(-index)));
        }

        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var result = await repository.SearchApprovedHallsAsync(null, null, null, null, null, 2, 2);

        Assert.Equal(2, result.Count);
        Assert.Equal("Hall 2", result[0].Name);
        Assert.Equal("Hall 3", result[1].Name);
    }

    [Fact]
    public async Task SearchApprovedHallsCountAsync_CountsMatchingHallsBeforePaging()
    {
        await using var context = CreateContext();
        context.Halls.AddRange(
            CreateHall("Royal Hall", region: HallRegion.Gaza),
            CreateHall("Royal Hall", region: HallRegion.NorthGaza),
            CreateHall("Other Hall", region: HallRegion.Gaza));
        var bookedHall = CreateHall("Royal Hall", region: HallRegion.Gaza);
        context.Halls.Add(bookedHall);
        context.HallAvailabilities.Add(new HallAvailability
        {
            HallId = bookedHall.Id,
            Date = new DateOnly(2026, 8, 10),
            PeriodType = BookingPeriodType.FirstPeriod,
            Status = AvailabilityStatus.Booked
        });
        await context.SaveChangesAsync();

        var repository = new HallRepository(context);

        var totalCount = await repository.SearchApprovedHallsCountAsync(
            "Royal",
            HallRegion.Gaza,
            null,
            new DateOnly(2026, 8, 10),
            BookingPeriodType.FirstPeriod);

        Assert.Equal(1, totalCount);
    }

    [Fact]
    public async Task SearchApprovedHallsCountAsync_ReturnsZeroWhenNoHallMatches()
    {
        await using var context = CreateContext();

        var repository = new HallRepository(context);

        var totalCount = await repository.SearchApprovedHallsCountAsync("Nothing", null, null, null, null);

        Assert.Equal(0, totalCount);
    }

    private static Hall CreateHall(
        string name,
        HallRegion region = HallRegion.Gaza,
        string address = "Gaza City",
        HallStatus status = HallStatus.Approved,
        bool isDeleted = false,
        DateTimeOffset? createdAt = null)
        => new()
        {
            Id = Guid.NewGuid(),
            Name = name,
            Region = region,
            Address = address,
            Status = status,
            IsDeleted = isDeleted,
            CreatedAt = createdAt ?? FixedNow
        };

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }
}