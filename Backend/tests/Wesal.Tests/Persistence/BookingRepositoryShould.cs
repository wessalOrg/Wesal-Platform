using Microsoft.EntityFrameworkCore;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Persistence;

public class BookingRepositoryShould
{
    private static readonly DateOnly BookingDate = new(2035, 6, 1);
    private static readonly TimeOnly BookingStart = new(10, 0);
    private static readonly TimeOnly OtherStart = new(11, 0);

    [Fact]
    public async Task AddAsync_PersistsBookingAndSlots()
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
        Assert.Equal(BookingStart, Assert.Single(stored.Slots).StartTime);
    }

    [Fact]
    public async Task GetByIdWithHallAsync_IncludesHallAndSlots()
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
        Assert.Equal(BookingStart, Assert.Single(result.Slots).StartTime);
    }

    [Fact]
    public async Task GetByIdWithHallAsync_UnknownId_ReturnsNull()
    {
        await using var context = CreateContext();
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

        var eligible = CreateBooking(hall, BookingStatus.Rejected);
        eligible.RejectionReason = "Not available";
        eligible.RejectionMessageId = null;

        var alreadyDelivered = CreateBooking(hall, BookingStatus.Rejected, "user-2", new DateOnly(2035, 6, 2), OtherStart);
        alreadyDelivered.RejectionReason = "Already notified";
        alreadyDelivered.RejectionMessageId = Guid.NewGuid();

        var pendingNoReason = CreateBooking(hall, BookingStatus.Rejected, "user-3", new DateOnly(2035, 6, 3), BookingStart);
        pendingNoReason.RejectionReason = null;
        pendingNoReason.RejectionMessageId = null;

        var pendingStatus = CreateBooking(hall, BookingStatus.Pending, "user-4", new DateOnly(2035, 6, 4), BookingStart);
        pendingStatus.RejectionReason = null;
        pendingStatus.RejectionMessageId = null;

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

        Assert.Contains(
            entityType.GetIndexes(),
            index => index.Properties.Select(property => property.Name).SequenceEqual(["HallId", "Date", "Status"]));

        var foreignKeys = entityType.GetForeignKeys().ToList();
        Assert.Contains(
            foreignKeys,
            foreignKey => foreignKey.PrincipalEntityType.ClrType == typeof(Hall)
                && foreignKey.DeleteBehavior == DeleteBehavior.Cascade);
    }

    [Fact]
    public void Model_ConfiguresUniqueIndexesForHourlyAvailability()
    {
        using var context = CreateContext();
        var slotEntityType = context.Model.FindEntityType(typeof(HallSlotAvailability))!;
        var bookingSlotEntityType = context.Model.FindEntityType(typeof(BookingSlot))!;

        Assert.Contains(
            slotEntityType.GetIndexes(),
            index => index.IsUnique
                && index.Properties.Select(property => property.Name).SequenceEqual(["HallId", "Date", "StartTime"]));

        Assert.Contains(
            bookingSlotEntityType.GetIndexes(),
            index => index.IsUnique
                && index.Properties.Select(property => property.Name).SequenceEqual(["BookingId", "StartTime"]));
    }

    [Fact]
    public async Task CancelPendingAsync_PendingBooking_TransitionsToCancelled()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var booking = SeedBooking(context, hall, "user-1", BookingDate, BookingStart);
        var repository = new BookingRepository(context);

        var affectedRows = await repository.CancelPendingAsync(booking.Id, booking.RequesterUserId);

        Assert.Equal(1, affectedRows);
        var stored = await repository.GetByIdWithHallAsync(booking.Id);
        Assert.NotNull(stored);
        Assert.Equal(BookingStatus.Cancelled, stored!.Status);
        Assert.Equal(booking.HallId, stored.HallId);
        Assert.Equal(booking.RequesterUserId, stored.RequesterUserId);
        Assert.Equal(booking.Date, stored.Date);
        Assert.Equal(BookingStart, Assert.Single(stored.Slots).StartTime);
    }

    [Fact]
    public async Task CancelPendingAsync_Accepted_ReturnsZero()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var booking = SeedBooking(context, hall, "user-1", BookingDate, BookingStart, BookingStatus.Accepted);
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
        var booking = SeedBooking(context, hall, "user-1", BookingDate, BookingStart, BookingStatus.Rejected);
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
        var booking = SeedBooking(context, hall, "user-1", BookingDate, BookingStart, BookingStatus.Cancelled);
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
        var booking = SeedBooking(context, hall, "user-1", BookingDate, BookingStart);
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
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingStart);
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
    public async Task CancelPendingAsync_AfterCancellation_AcceptanceConditionalUpdate_ReturnsZero()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var booking = SeedBooking(context, hall, "user-1", BookingDate, BookingStart);
        var repository = new BookingRepository(context);

        await repository.CancelPendingAsync(booking.Id, booking.RequesterUserId);

        var approvalRows = await repository.AcceptPendingAsync(booking.Id);

        Assert.Equal(0, approvalRows);
        var stored = await repository.GetByIdWithHallAsync(booking.Id);
        Assert.Equal(BookingStatus.Cancelled, stored!.Status);
    }

    [Fact]
    public async Task ReleaseBookingSlotsAsync_ReopensExactSlotsAndLeavesOthersUntouched()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var booking = SeedBooking(context, hall, "user-1", BookingDate, BookingStart);
        var target = SeedSlotAvailability(context, hall, BookingDate, BookingStart, HallSlotStatus.Booked);
        var otherSlot = SeedSlotAvailability(context, hall, BookingDate, OtherStart, HallSlotStatus.Booked);
        var otherDate = SeedSlotAvailability(context, hall, new DateOnly(2035, 6, 2), BookingStart, HallSlotStatus.Booked);
        var repository = new BookingRepository(context);

        var affectedRows = await repository.ReleaseBookingSlotsAsync(
            booking.Id,
            booking.HallId,
            booking.Date,
            [BookingStart]);

        Assert.Equal(1, affectedRows);
        Assert.Equal(HallSlotStatus.Available, (await context.HallSlotAvailabilities.FindAsync(target.Id))!.Status);
        Assert.Equal(HallSlotStatus.Booked, (await context.HallSlotAvailabilities.FindAsync(otherSlot.Id))!.Status);
        Assert.Equal(HallSlotStatus.Booked, (await context.HallSlotAvailabilities.FindAsync(otherDate.Id))!.Status);
    }

    [Fact]
    public async Task ReleaseBookingSlotsAsync_AlreadyAvailable_ReturnsZero()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var booking = SeedBooking(context, hall, "user-1", BookingDate, BookingStart);
        var availability = SeedSlotAvailability(context, hall, BookingDate, BookingStart, HallSlotStatus.Available);
        var repository = new BookingRepository(context);

        var affectedRows = await repository.ReleaseBookingSlotsAsync(
            booking.Id,
            booking.HallId,
            booking.Date,
            [BookingStart]);

        Assert.Equal(0, affectedRows);
        var stored = await context.HallSlotAvailabilities.FindAsync(availability.Id);
        Assert.Equal(HallSlotStatus.Available, stored!.Status);
    }

    [Fact]
    public async Task ReleaseBookingSlotsAsync_KeepsSlotBookedWhenAnotherActiveBookingHoldsIt()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var target = SeedBooking(context, hall, "user-1", BookingDate, BookingStart);
        SeedBooking(context, hall, "user-2", BookingDate, BookingStart, BookingStatus.Accepted);
        var availability = SeedSlotAvailability(context, hall, BookingDate, BookingStart, HallSlotStatus.Booked);
        var repository = new BookingRepository(context);

        var affectedRows = await repository.ReleaseBookingSlotsAsync(
            target.Id,
            target.HallId,
            target.Date,
            [BookingStart]);

        Assert.Equal(0, affectedRows);
        Assert.Equal(HallSlotStatus.Booked, (await context.HallSlotAvailabilities.FindAsync(availability.Id))!.Status);
    }

    [Fact]
    public async Task ReserveHourlySlotsAsync_NoSlotRow_BooksAndReturnsOne()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var repository = new BookingRepository(context);

        var affectedRows = await repository.ReserveHourlySlotsAsync(hall.Id, BookingDate, [BookingStart]);

        Assert.Equal(1, affectedRows);
        var stored = Assert.Single(context.HallSlotAvailabilities);
        Assert.Equal(hall.Id, stored.HallId);
        Assert.Equal(BookingDate, stored.Date);
        Assert.Equal(BookingStart, stored.StartTime);
        Assert.Equal(HallSlotStatus.Booked, stored.Status);
    }

    [Fact]
    public async Task ReserveHourlySlotsAsync_AvailableSlot_BooksAndReturnsOne()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var availability = SeedSlotAvailability(context, hall, BookingDate, BookingStart, HallSlotStatus.Available);
        var repository = new BookingRepository(context);

        var affectedRows = await repository.ReserveHourlySlotsAsync(hall.Id, BookingDate, [BookingStart]);

        Assert.Equal(1, affectedRows);
        var stored = await context.HallSlotAvailabilities.FindAsync(availability.Id);
        Assert.Equal(HallSlotStatus.Booked, stored!.Status);
    }

    [Fact]
    public async Task ReserveHourlySlotsAsync_BookedSlot_ReturnsZero()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var availability = SeedSlotAvailability(context, hall, BookingDate, BookingStart, HallSlotStatus.Booked);
        var repository = new BookingRepository(context);

        var affectedRows = await repository.ReserveHourlySlotsAsync(hall.Id, BookingDate, [BookingStart]);

        Assert.Equal(0, affectedRows);
        var stored = await context.HallSlotAvailabilities.FindAsync(availability.Id);
        Assert.Equal(HallSlotStatus.Booked, stored!.Status);
    }

    [Fact]
    public async Task ReserveHourlySlotsAsync_StopsAtFirstBookedSlot()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var second = SeedSlotAvailability(context, hall, BookingDate, OtherStart, HallSlotStatus.Booked);
        var repository = new BookingRepository(context);

        var affectedRows = await repository.ReserveHourlySlotsAsync(hall.Id, BookingDate, [BookingStart, OtherStart]);

        Assert.Equal(1, affectedRows);
        Assert.Equal(HallSlotStatus.Booked, (await context.HallSlotAvailabilities.FindAsync(second.Id))!.Status);
        Assert.Equal(HallSlotStatus.Booked, Assert.Single(context.HallSlotAvailabilities.Where(candidate => candidate.StartTime == BookingStart)).Status);
    }

    [Fact]
    public async Task IsDayOpenAsync_MissingGateDefaultsToOpen()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var repository = new BookingRepository(context);

        Assert.True(await repository.IsDayOpenAsync(hall.Id, BookingDate));
    }

    [Fact]
    public async Task SetDayOpenAsync_CreatesAndUpdatesDayGate()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        var repository = new BookingRepository(context);

        await repository.SetDayOpenAsync(hall.Id, BookingDate, false);
        Assert.False(await repository.IsDayOpenAsync(hall.Id, BookingDate));

        await repository.SetDayOpenAsync(hall.Id, BookingDate, true);
        Assert.True(await repository.IsDayOpenAsync(hall.Id, BookingDate));
        Assert.Single(context.HallDayAvailabilities);
    }

    [Fact]
    public async Task HasActiveBookingsOnDayAsync_IncludesPendingAndAccepted()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        SeedBooking(context, hall, "user-1", BookingDate, BookingStart, BookingStatus.Pending);
        SeedBooking(context, hall, "user-2", BookingDate, OtherStart, BookingStatus.Accepted);
        var repository = new BookingRepository(context);

        Assert.True(await repository.HasActiveBookingsOnDayAsync(hall.Id, BookingDate));
        Assert.False(await repository.HasActiveBookingsOnDayAsync(hall.Id, new DateOnly(2035, 6, 2)));
    }

    [Fact]
    public async Task HasActiveHourlyBookingsOutsideWindowAsync_IgnoresCancelledBookings()
    {
        await using var context = CreateContext();
        var hall = SeedHall(context);
        SeedBooking(context, hall, "user-1", BookingDate, new TimeOnly(9, 0), BookingStatus.Cancelled);
        var repository = new BookingRepository(context);

        Assert.False(await repository.HasActiveHourlyBookingsOutsideWindowAsync(hall.Id, new TimeOnly(9, 0), new TimeOnly(12, 0)));

        SeedBooking(context, hall, "user-2", BookingDate, new TimeOnly(8, 0));
        Assert.True(await repository.HasActiveHourlyBookingsOutsideWindowAsync(hall.Id, new TimeOnly(9, 0), new TimeOnly(12, 0)));
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
        TimeOnly startTime,
        BookingStatus status = BookingStatus.Pending)
    {
        var booking = CreateBooking(hall, status, requesterUserId, date, startTime);
        context.Bookings.Add(booking);
        context.SaveChanges();

        return booking;
    }

    private static HallSlotAvailability SeedSlotAvailability(
        ApplicationDbContext context,
        Hall hall,
        DateOnly date,
        TimeOnly startTime,
        HallSlotStatus status)
    {
        var availability = new HallSlotAvailability
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            Hall = hall,
            Date = date,
            StartTime = startTime,
            Status = status
        };

        context.HallSlotAvailabilities.Add(availability);
        context.SaveChanges();

        return availability;
    }

    private static Booking CreateBooking(
        Hall hall,
        BookingStatus status = BookingStatus.Pending,
        string requesterUserId = "user-1",
        DateOnly date = default,
        TimeOnly startTime = default)
    {
        var selectedDate = date == default ? BookingDate : date;
        var selectedStart = startTime == default ? BookingStart : startTime;

        return new Booking
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            Hall = hall,
            RequesterUserId = requesterUserId,
            Date = selectedDate,
            Slots =
            [
                new BookingSlot
                {
                    Id = Guid.NewGuid(),
                    StartTime = selectedStart,
                    EndTime = selectedStart.AddHours(1)
                }
            ],
            Status = status
        };
    }

    private static ApplicationDbContext CreateContext(string? databaseName = null)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName ?? Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }
}
