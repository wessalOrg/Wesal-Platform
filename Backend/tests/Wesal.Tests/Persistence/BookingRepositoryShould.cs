using Microsoft.EntityFrameworkCore;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Persistence;

public class BookingRepositoryShould
{
    [Fact]
    public async Task AddAsync_PersistsBooking()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var booking = CreateBooking(hall);
        var repository = new BookingRepository(context);

        await repository.AddAsync(booking);

        var stored = await repository.GetByIdWithHallAsync(booking.Id);
        Assert.NotNull(stored);
        Assert.Equal(booking.Id, stored!.Id);
        Assert.Equal(BookingStatus.Pending, stored.Status);
    }

    [Fact]
    public async Task GetByIdWithHallAsync_IncludesHall()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var booking = CreateBooking(hall);
        var repository = new BookingRepository(context);
        await repository.AddAsync(booking);

        var result = await repository.GetByIdWithHallAsync(booking.Id);

        Assert.NotNull(result);
        Assert.Equal(hall.Id, result!.HallId);
        Assert.NotNull(result.Hall);
        Assert.Equal(hall.Name, result.Hall.Name);
    }

    [Fact]
    public async Task GetByIdWithHallAsync_UnknownId_ReturnsNull()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var repository = new BookingRepository(context);

        var result = await repository.GetByIdWithHallAsync(Guid.NewGuid());

        Assert.Null(result);
    }

    [Fact]
    public async Task GetPendingRejectionNotificationsAsync_ReturnsOnlyUndeliveredRejectedWithReason()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var repository = new BookingRepository(context);

        var eligible = new Booking
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            RequesterUserId = "user-1",
            Date = new DateOnly(2035, 6, 1),
            Period = BookingPeriodType.FirstPeriod,
            Status = BookingStatus.Rejected,
            RejectionReason = "Not available",
            RejectionMessageId = null
        };

        var alreadyDelivered = new Booking
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            RequesterUserId = "user-2",
            Date = new DateOnly(2035, 6, 2),
            Period = BookingPeriodType.SecondPeriod,
            Status = BookingStatus.Rejected,
            RejectionReason = "Already notified",
            RejectionMessageId = Guid.NewGuid()
        };

        var pendingNoReason = new Booking
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            RequesterUserId = "user-3",
            Date = new DateOnly(2035, 6, 3),
            Period = BookingPeriodType.FirstPeriod,
            Status = BookingStatus.Rejected,
            RejectionReason = null,
            RejectionMessageId = null
        };

        var pendingStatus = new Booking
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            RequesterUserId = "user-4",
            Date = new DateOnly(2035, 6, 4),
            Period = BookingPeriodType.FirstPeriod,
            Status = BookingStatus.Pending,
            RejectionReason = null,
            RejectionMessageId = null
        };

        context.Bookings.AddRange(eligible, alreadyDelivered, pendingNoReason, pendingStatus);
        await context.SaveChangesAsync();

        var result = await repository.GetPendingRejectionNotificationsAsync();

        var delivered = Assert.Single(result);
        Assert.Equal(eligible.Id, delivered.Id);
    }

    [Fact]
    public void Model_ConfiguresIndexesAndCascadeForBooking()
    {
        using var context = CreateContext();
        var entityType = context.Model.FindEntityType(typeof(Booking))!;

        Assert.Contains(
            entityType.GetIndexes(),
            index => index.IsUnique
                && index.Properties.Select(property => property.Name).SequenceEqual(["RejectionMessageId"]));

        Assert.Contains(
            entityType.GetIndexes(),
            index => index.Properties.Select(property => property.Name).SequenceEqual(["HallId", "RequesterUserId"]));

        var foreignKeys = entityType.GetForeignKeys().ToList();
        Assert.Contains(
            foreignKeys,
            foreignKey => foreignKey.PrincipalEntityType.ClrType == typeof(Hall)
                && foreignKey.DeleteBehavior == DeleteBehavior.Cascade);
    }

    private static Hall SeedHall(ApplicationDbContext context)
    {
        var hall = new Hall
        {
            Id = Guid.NewGuid(),
            Name = "Grand Hall",
            Status = HallStatus.Approved,
            OwnerId = "owner-1"
        };

        context.Halls.Add(hall);
        context.SaveChanges();

        return hall;
    }

    private static Booking CreateBooking(Hall hall, BookingStatus status = BookingStatus.Pending)
        => new()
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            RequesterUserId = "user-1",
            Date = new DateOnly(2035, 6, 1),
            Period = BookingPeriodType.FirstPeriod,
            Status = status
        };

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }
}