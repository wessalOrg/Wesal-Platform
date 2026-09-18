using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.InMemory;
using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Bookings;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Persistence;

public class BookingAcceptanceFlowShould
{
    private static readonly DateOnly BookingDate = new(2035, 6, 1);

    [Fact]
    public async Task Accept_PendingBooking_PersistsAcceptedAndKeepsPeriodProtected()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid bookingId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingPeriodType.FirstPeriod);
            bookingId = booking.Id;
            SeedAvailability(seedingContext, hall, BookingDate, BookingPeriodType.FirstPeriod, AvailabilityStatus.Booked);
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "owner-1", [ApplicationRoles.HallOwner]);

            var result = await service.AcceptBookingAsync(hallId, bookingId);

            Assert.Equal(bookingId, result.BookingId);
            Assert.Equal(hallId, result.HallId);
            Assert.Equal("user-1", result.RequesterUserId);
            Assert.Equal(BookingDate, result.Date);
            Assert.Equal(BookingPeriodType.FirstPeriod, result.Period);
            Assert.Equal(BookingStatus.Accepted, result.Status);

            var booking = context.Bookings.AsNoTracking().Single(b => b.Id == bookingId);
            Assert.Equal(BookingStatus.Accepted, booking.Status);
            Assert.Equal(hallId, booking.HallId);
            Assert.Equal("user-1", booking.RequesterUserId);
            Assert.Equal(BookingDate, booking.Date);
            Assert.Equal(BookingPeriodType.FirstPeriod, booking.Period);

            var availability = context.HallAvailabilities.AsNoTracking().Single(a =>
                a.HallId == hallId && a.Date == BookingDate && a.PeriodType == BookingPeriodType.FirstPeriod);
            Assert.Equal(AvailabilityStatus.Booked, availability.Status);
        }
    }

    [Fact]
    public async Task Accept_OtherOwnersHall_ThrowsForbidden_AndStatusUnchanged()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid bookingId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingPeriodType.FirstPeriod);
            bookingId = booking.Id;
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "intruder-owner", [ApplicationRoles.HallOwner]);

            await Assert.ThrowsAsync<ForbiddenException>(() =>
                service.AcceptBookingAsync(hallId, bookingId));

            var booking = context.Bookings.AsNoTracking().Single(b => b.Id == bookingId);
            Assert.Equal(BookingStatus.Pending, booking.Status);
        }
    }

    [Fact]
    public async Task Accept_RejectedBooking_ThrowsConflict_AndStatusUnchanged()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid bookingId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingPeriodType.FirstPeriod, BookingStatus.Rejected);
            bookingId = booking.Id;
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "owner-1", [ApplicationRoles.HallOwner]);

            await Assert.ThrowsAsync<ConflictException>(() =>
                service.AcceptBookingAsync(hallId, bookingId));

            var booking = context.Bookings.AsNoTracking().Single(b => b.Id == bookingId);
            Assert.Equal(BookingStatus.Rejected, booking.Status);
        }
    }

    [Fact]
    public async Task Accept_CancelledBooking_ThrowsConflict_AndStatusUnchanged()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid bookingId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingPeriodType.FirstPeriod, BookingStatus.Cancelled);
            bookingId = booking.Id;
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "owner-1", [ApplicationRoles.HallOwner]);

            await Assert.ThrowsAsync<ConflictException>(() =>
                service.AcceptBookingAsync(hallId, bookingId));

            var booking = context.Bookings.AsNoTracking().Single(b => b.Id == bookingId);
            Assert.Equal(BookingStatus.Cancelled, booking.Status);
        }
    }

    [Fact]
    public async Task Accept_RaceWithCancellation_OnlyOneWinner()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid bookingId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingPeriodType.FirstPeriod);
            bookingId = booking.Id;
        }

        // Cancellation already won the race (cheaper to simulate: cancel first).
        await using (var cancelContext = CreateContext(databaseName))
        {
            var cancelRows = await new BookingRepository(cancelContext).CancelPendingAsync(bookingId, "user-1");
            Assert.Equal(1, cancelRows);
        }

        await using (var acceptContext = CreateContext(databaseName))
        {
            var service = CreateService(acceptContext, "owner-1", [ApplicationRoles.HallOwner]);

            var exception = await Assert.ThrowsAsync<ConflictException>(() =>
                service.AcceptBookingAsync(hallId, bookingId));

            Assert.Contains("cancelled", exception.Message, StringComparison.OrdinalIgnoreCase);
        }

        await using (var readContext = CreateContext(databaseName))
        {
            var booking = readContext.Bookings.AsNoTracking().Single(b => b.Id == bookingId);
            Assert.Equal(BookingStatus.Cancelled, booking.Status);
        }
    }

    private static BookingAcceptanceService CreateService(
        ApplicationDbContext context,
        string userId,
        string[] roles)
        => new(
            new BookingRepository(context),
            new UnitOfWork(context),
            new FakeCurrentUserService(userId, roles));

    private static Hall SeedHall(ApplicationDbContext context, Guid id)
    {
        var hall = new Hall
        {
            Id = id,
            Name = "Grand Hall",
            Status = HallStatus.Approved,
            PaymentStatus = HallPaymentStatus.Paid,
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
            HallId = hall.Id,
            RequesterUserId = requesterUserId,
            Date = date,
            Period = period,
            Status = status
        };

        context.Bookings.Add(booking);
        context.SaveChanges();

        return booking;
    }

    private static void SeedAvailability(
        ApplicationDbContext context,
        Hall hall,
        DateOnly date,
        BookingPeriodType periodType,
        AvailabilityStatus status)
    {
        context.HallAvailabilities.Add(new HallAvailability
        {
            HallId = hall.Id,
            Date = date,
            PeriodType = periodType,
            Status = status
        });

        context.SaveChanges();
    }

    private static ApplicationDbContext CreateContext(string databaseName)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName)
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new ApplicationDbContext(options);
    }

    private sealed class FakeCurrentUserService : ICurrentUserService
    {
        public FakeCurrentUserService(string userId, params string[] roles)
        {
            UserId = userId;
            Roles = roles;
        }

        public string? UserId { get; }

        public string? UserName => "testuser";

        public string? Email => "test@example.com";

        public bool IsAuthenticated => true;

        public IReadOnlyList<string> Roles { get; }
    }
}