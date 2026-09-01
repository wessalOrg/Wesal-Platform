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

    [Fact]
    public void Model_ConfiguresUniqueIndexForHallAvailability()
    {
        using var context = CreateContext();
        var entityType = context.Model.FindEntityType(typeof(HallAvailability))!;

        Assert.Contains(
            entityType.GetIndexes(),
            index => index.IsUnique
                && index.Properties.Select(property => property.Name).SequenceEqual(["HallId", "Date", "PeriodType"]));
    }

    [Fact]
    public async Task CancelPendingAsync_PendingBooking_TransitionsToCancelled()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var booking = SeedBooking(context, hall, "user-1", new DateOnly(2035, 6, 1), BookingPeriodType.FirstPeriod);
        var repository = new BookingRepository(context);

        var affectedRows = await repository.CancelPendingAsync(booking.Id, booking.RequesterUserId);

        Assert.Equal(1, affectedRows);
        var stored = await repository.GetByIdWithHallAsync(booking.Id);
        Assert.NotNull(stored);
        Assert.Equal(BookingStatus.Cancelled, stored!.Status);
        Assert.Equal(booking.HallId, stored.HallId);
        Assert.Equal(booking.RequesterUserId, stored.RequesterUserId);
        Assert.Equal(booking.Date, stored.Date);
        Assert.Equal(booking.Period, stored.Period);
    }

    [Fact]
    public async Task CancelPendingAsync_Accepted_ReturnsZero()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var booking = SeedBooking(context, hall, "user-1", new DateOnly(2035, 6, 1), BookingPeriodType.FirstPeriod, BookingStatus.Accepted);
        var repository = new BookingRepository(context);

        var affectedRows = await repository.CancelPendingAsync(booking.Id, booking.RequesterUserId);

        Assert.Equal(0, affectedRows);
        var stored = await repository.GetByIdWithHallAsync(booking.Id);
        Assert.Equal(BookingStatus.Accepted, stored!.Status);
    }

    [Fact]
    public async Task CancelPendingAsync_Rejected_ReturnsZero()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var booking = SeedBooking(context, hall, "user-1", new DateOnly(2035, 6, 1), BookingPeriodType.FirstPeriod, BookingStatus.Rejected);
        var repository = new BookingRepository(context);

        var affectedRows = await repository.CancelPendingAsync(booking.Id, booking.RequesterUserId);

        Assert.Equal(0, affectedRows);
        var stored = await repository.GetByIdWithHallAsync(booking.Id);
        Assert.Equal(BookingStatus.Rejected, stored!.Status);
    }

    [Fact]
    public async Task CancelPendingAsync_AlreadyCancelled_ReturnsZero()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var booking = SeedBooking(context, hall, "user-1", new DateOnly(2035, 6, 1), BookingPeriodType.FirstPeriod, BookingStatus.Cancelled);
        var repository = new BookingRepository(context);

        var affectedRows = await repository.CancelPendingAsync(booking.Id, booking.RequesterUserId);

        Assert.Equal(0, affectedRows);
        var stored = await repository.GetByIdWithHallAsync(booking.Id);
        Assert.Equal(BookingStatus.Cancelled, stored!.Status);
    }

    [Fact]
    public async Task CancelPendingAsync_OtherRequester_ReturnsZero()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var booking = SeedBooking(context, hall, "user-1", new DateOnly(2035, 6, 1), BookingPeriodType.FirstPeriod);
        var repository = new BookingRepository(context);

        var affectedRows = await repository.CancelPendingAsync(booking.Id, "user-2");

        Assert.Equal(0, affectedRows);
        var stored = await repository.GetByIdWithHallAsync(booking.Id);
        Assert.Equal(BookingStatus.Pending, stored!.Status);
    }

    [Fact]
    public async Task CancelPendingAsync_ConcurrentAttempts_OnlyFirstWins()
    {
        var databaseName = Guid.NewGuid().ToString();
        Guid bookingId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext);
            var booking = SeedBooking(seedingContext, hall, "user-1", new DateOnly(2035, 6, 1), BookingPeriodType.FirstPeriod);
            bookingId = booking.Id;
        }

        int firstRows;
        int secondRows;

        await using (var firstContext = CreateContext(databaseName))
        {
            firstRows = await new BookingRepository(firstContext)
                .CancelPendingAsync(bookingId, "user-1");
        }

        await using (var secondContext = CreateContext(databaseName))
        {
            secondRows = await new BookingRepository(secondContext)
                .CancelPendingAsync(bookingId, "user-1");
        }

        await using (var readContext = CreateContext(databaseName))
        {
            var stored = await readContext.Bookings.FindAsync(bookingId);
            Assert.NotNull(stored);
            Assert.Equal(BookingStatus.Cancelled, stored!.Status);
        }

        Assert.Equal(1, firstRows);
        Assert.Equal(0, secondRows);
    }

    [Fact]
    public async Task CancelPendingAsync_AfterCancellation_ApprovalConditionalUpdate_ReturnsZero()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var booking = SeedBooking(context, hall, "user-1", new DateOnly(2035, 6, 1), BookingPeriodType.FirstPeriod);
        var repository = new BookingRepository(context);

        await repository.CancelPendingAsync(booking.Id, booking.RequesterUserId);

        var approvalRows = await TryApproveAsync(context, booking.Id);

        Assert.Equal(0, approvalRows);
        var stored = await repository.GetByIdWithHallAsync(booking.Id);
        Assert.Equal(BookingStatus.Cancelled, stored!.Status);
    }

    [Fact]
    public async Task HasOtherActiveBookingsAsync_True_WhenAnotherPending()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var booking = SeedBooking(context, hall, "user-1", new DateOnly(2035, 6, 1), BookingPeriodType.FirstPeriod);
        SeedBooking(context, hall, "user-2", new DateOnly(2035, 6, 1), BookingPeriodType.FirstPeriod);
        var repository = new BookingRepository(context);

        var hasOther = await repository.HasOtherActiveBookingsAsync(
            hall.Id, booking.Date, booking.Period, booking.Id);

        Assert.True(hasOther);
    }

    [Fact]
    public async Task HasOtherActiveBookingsAsync_True_WhenAnotherAccepted()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var booking = SeedBooking(context, hall, "user-1", new DateOnly(2035, 6, 1), BookingPeriodType.FirstPeriod);
        SeedBooking(context, hall, "user-2", new DateOnly(2035, 6, 1), BookingPeriodType.FirstPeriod, BookingStatus.Accepted);
        var repository = new BookingRepository(context);

        var hasOther = await repository.HasOtherActiveBookingsAsync(
            hall.Id, booking.Date, booking.Period, booking.Id);

        Assert.True(hasOther);
    }

    [Fact]
    public async Task HasOtherActiveBookingsAsync_False_WhenOnlyRejectedOrCancelled()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var booking = SeedBooking(context, hall, "user-1", new DateOnly(2035, 6, 1), BookingPeriodType.FirstPeriod);
        SeedBooking(context, hall, "user-2", new DateOnly(2035, 6, 1), BookingPeriodType.FirstPeriod, BookingStatus.Rejected);
        SeedBooking(context, hall, "user-3", new DateOnly(2035, 6, 1), BookingPeriodType.FirstPeriod, BookingStatus.Cancelled);
        var repository = new BookingRepository(context);

        var hasOther = await repository.HasOtherActiveBookingsAsync(
            hall.Id, booking.Date, booking.Period, booking.Id);

        Assert.False(hasOther);
    }

    [Fact]
    public async Task HasOtherActiveBookingsAsync_False_ForDifferentPeriodOrDate()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var booking = SeedBooking(context, hall, "user-1", new DateOnly(2035, 6, 1), BookingPeriodType.FirstPeriod);
        SeedBooking(context, hall, "user-2", new DateOnly(2035, 6, 1), BookingPeriodType.SecondPeriod);
        SeedBooking(context, hall, "user-3", new DateOnly(2035, 6, 2), BookingPeriodType.FirstPeriod);
        var repository = new BookingRepository(context);

        var hasOther = await repository.HasOtherActiveBookingsAsync(
            hall.Id, booking.Date, booking.Period, booking.Id);

        Assert.False(hasOther);
    }

    [Fact]
    public async Task ReleasePeriodAsync_UnbooksExactPeriod_UnrelatedPeriodsUntouched()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var date = new DateOnly(2035, 6, 1);
        var target = SeedAvailability(context, hall, date, BookingPeriodType.FirstPeriod, AvailabilityStatus.Booked);
        var otherPeriod = SeedAvailability(context, hall, date, BookingPeriodType.SecondPeriod, AvailabilityStatus.Booked);
        var otherDate = SeedAvailability(context, hall, new DateOnly(2035, 6, 2), BookingPeriodType.FirstPeriod, AvailabilityStatus.Booked);
        var repository = new BookingRepository(context);

        var affectedRows = await repository.ReleasePeriodAsync(hall.Id, date, BookingPeriodType.FirstPeriod);

        Assert.Equal(1, affectedRows);
        var released = await context.HallAvailabilities.FindAsync(target.Id);
        Assert.Equal(AvailabilityStatus.Available, released!.Status);
        Assert.Equal(AvailabilityStatus.Booked, (await context.HallAvailabilities.FindAsync(otherPeriod.Id))!.Status);
        Assert.Equal(AvailabilityStatus.Booked, (await context.HallAvailabilities.FindAsync(otherDate.Id))!.Status);
    }

    [Fact]
    public async Task ReleasePeriodAsync_AlreadyAvailable_ReturnsZero()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var date = new DateOnly(2035, 6, 1);
        var availability = SeedAvailability(context, hall, date, BookingPeriodType.FirstPeriod, AvailabilityStatus.Available);
        var repository = new BookingRepository(context);

        var affectedRows = await repository.ReleasePeriodAsync(hall.Id, date, BookingPeriodType.FirstPeriod);

        Assert.Equal(0, affectedRows);
        var stored = await context.HallAvailabilities.FindAsync(availability.Id);
        Assert.Equal(AvailabilityStatus.Available, stored!.Status);
    }

    [Fact]
    public async Task PendingSet_ExcludesCancelled_AndKeepsHistory()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var pending = SeedBooking(context, hall, "user-1", new DateOnly(2035, 6, 1), BookingPeriodType.FirstPeriod);
        var cancelled = SeedBooking(context, hall, "user-2", new DateOnly(2035, 6, 2), BookingPeriodType.SecondPeriod, BookingStatus.Cancelled);
        var repository = new BookingRepository(context);

        var ownerPendingSet = await context.Bookings
            .Where(b => b.HallId == hall.Id && b.Status == BookingStatus.Pending)
            .ToListAsync();

        var onlyPending = Assert.Single(ownerPendingSet);
        Assert.Equal(pending.Id, onlyPending.Id);

        var stored = await repository.GetByIdWithHallAsync(cancelled.Id);
        Assert.NotNull(stored);
        Assert.Equal(BookingStatus.Cancelled, stored!.Status);
    }

    [Fact]
    public async Task ReservePeriodAsync_NoAvailabilityRow_BooksAndReturnsOne()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var date = new DateOnly(2035, 6, 1);
        var repository = new BookingRepository(context);

        var affectedRows = await repository.ReservePeriodAsync(hall.Id, date, BookingPeriodType.FirstPeriod);

        Assert.Equal(1, affectedRows);
        var stored = Assert.Single(context.HallAvailabilities);
        Assert.Equal(hall.Id, stored.HallId);
        Assert.Equal(date, stored.Date);
        Assert.Equal(BookingPeriodType.FirstPeriod, stored.PeriodType);
        Assert.Equal(AvailabilityStatus.Booked, stored.Status);
    }

    [Fact]
    public async Task ReservePeriodAsync_AvailableRow_BooksAndReturnsOne()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var date = new DateOnly(2035, 6, 1);
        var availability = SeedAvailability(context, hall, date, BookingPeriodType.FirstPeriod, AvailabilityStatus.Available);
        var repository = new BookingRepository(context);

        var affectedRows = await repository.ReservePeriodAsync(hall.Id, date, BookingPeriodType.FirstPeriod);

        Assert.Equal(1, affectedRows);
        var stored = await context.HallAvailabilities.FindAsync(availability.Id);
        Assert.Equal(AvailabilityStatus.Booked, stored!.Status);
    }

    [Fact]
    public async Task ReservePeriodAsync_BookedRow_ReturnsZero()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var date = new DateOnly(2035, 6, 1);
        var availability = SeedAvailability(context, hall, date, BookingPeriodType.FirstPeriod, AvailabilityStatus.Booked);
        var repository = new BookingRepository(context);

        var affectedRows = await repository.ReservePeriodAsync(hall.Id, date, BookingPeriodType.FirstPeriod);

        Assert.Equal(0, affectedRows);
        var stored = await context.HallAvailabilities.FindAsync(availability.Id);
        Assert.Equal(AvailabilityStatus.Booked, stored!.Status);
    }

    [Fact]
    public async Task ReservePeriodAsync_OnlyBooksExactPeriod_UnrelatedPeriodsUntouched()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var date = new DateOnly(2035, 6, 1);
        var target = SeedAvailability(context, hall, date, BookingPeriodType.FirstPeriod, AvailabilityStatus.Available);
        var otherPeriod = SeedAvailability(context, hall, date, BookingPeriodType.SecondPeriod, AvailabilityStatus.Booked);
        var otherDate = SeedAvailability(context, hall, new DateOnly(2035, 6, 2), BookingPeriodType.FirstPeriod, AvailabilityStatus.Available);
        var repository = new BookingRepository(context);

        var affectedRows = await repository.ReservePeriodAsync(hall.Id, date, BookingPeriodType.FirstPeriod);

        Assert.Equal(1, affectedRows);
        Assert.Equal(AvailabilityStatus.Booked, (await context.HallAvailabilities.FindAsync(target.Id))!.Status);
        Assert.Equal(AvailabilityStatus.Booked, (await context.HallAvailabilities.FindAsync(otherPeriod.Id))!.Status);
        Assert.Equal(AvailabilityStatus.Available, (await context.HallAvailabilities.FindAsync(otherDate.Id))!.Status);
    }

    private static async Task<int> TryApproveAsync(ApplicationDbContext context, Guid bookingId)
    {
        if (context.Database.IsRelational())
        {
            return await context.Bookings
                .Where(booking => booking.Id == bookingId && booking.Status == BookingStatus.Pending)
                .ExecuteUpdateAsync(set => set.SetProperty(booking => booking.Status, BookingStatus.Accepted));
        }

        var pending = await context.Bookings
            .FirstOrDefaultAsync(booking => booking.Id == bookingId && booking.Status == BookingStatus.Pending);

        if (pending is null)
        {
            return 0;
        }

        pending.Status = BookingStatus.Accepted;
        await context.SaveChangesAsync();

        return 1;
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

    private static Booking SeedBooking(
        ApplicationDbContext context,
        Hall hall,
        string requesterUserId,
        DateOnly date,
        BookingPeriodType period,
        BookingStatus status = BookingStatus.Pending)
    {
        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            Hall = hall,
            RequesterUserId = requesterUserId,
            Date = date,
            Period = period,
            Status = status
        };

        context.Bookings.Add(booking);
        context.SaveChanges();

        return booking;
    }

    private static HallAvailability SeedAvailability(
        ApplicationDbContext context,
        Hall hall,
        DateOnly date,
        BookingPeriodType periodType,
        AvailabilityStatus status)
    {
        var availability = new HallAvailability
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            Hall = hall,
            Date = date,
            PeriodType = periodType,
            Status = status
        };

        context.HallAvailabilities.Add(availability);
        context.SaveChanges();

        return availability;
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

    private static ApplicationDbContext CreateContext(string? databaseName = null)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName ?? Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }
}