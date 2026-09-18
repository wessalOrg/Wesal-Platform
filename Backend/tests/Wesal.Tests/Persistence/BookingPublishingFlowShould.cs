using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Bookings;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Persistence;

public class BookingPublishingFlowShould
{
    private static readonly DateOnly BookingDate = new(2035, 6, 1);

    [Fact]
    public async Task Publish_AcceptedBooking_PersistsPublished_andMarksOnlyItsPeriodBooked()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid bookingId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingPeriodType.FirstPeriod, BookingStatus.Accepted);
            bookingId = booking.Id;
            SeedAvailability(seedingContext, hall, BookingDate, BookingPeriodType.FirstPeriod, AvailabilityStatus.Booked);
            SeedAvailability(seedingContext, hall, BookingDate, BookingPeriodType.SecondPeriod, AvailabilityStatus.Available);
            SeedAvailability(seedingContext, hall, new DateOnly(2035, 6, 2), BookingPeriodType.FirstPeriod, AvailabilityStatus.Available);
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "owner-1", [ApplicationRoles.HallOwner]);

            var result = await service.PublishBookingAsync(hallId, bookingId);

            Assert.Equal(bookingId, result.BookingId);
            Assert.Equal(hallId, result.HallId);
            Assert.Equal("user-1", result.RequesterUserId);
            Assert.Equal(BookingDate, result.Date);
            Assert.Equal(BookingPeriodType.FirstPeriod, result.Period);
            Assert.Equal(BookingStatus.Accepted, result.Status);
            Assert.True(result.IsPublished);

            var booking = context.Bookings.AsNoTracking().Single(b => b.Id == bookingId);
            Assert.True(booking.IsPublished);
            Assert.Equal(BookingStatus.Accepted, booking.Status);
            Assert.Equal(hallId, booking.HallId);
            Assert.Equal("user-1", booking.RequesterUserId);
            Assert.Equal(BookingDate, booking.Date);
            Assert.Equal(BookingPeriodType.FirstPeriod, booking.Period);

            var availabilities = context.HallAvailabilities.AsNoTracking().ToList();
            var exact = Assert.Single(availabilities, a => a.PeriodType == BookingPeriodType.FirstPeriod && a.Date == BookingDate);
            Assert.Equal(AvailabilityStatus.Booked, exact.Status);
            Assert.Equal(AvailabilityStatus.Available, availabilities.Single(a => a.PeriodType == BookingPeriodType.SecondPeriod).Status);
            Assert.Equal(AvailabilityStatus.Available, availabilities.Single(a => a.Date == new DateOnly(2035, 6, 2)).Status);
        }
    }

    [Fact]
    public async Task Publish_MissingAvailabilityRow_GuaranteesBooked()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid bookingId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingPeriodType.FirstPeriod, BookingStatus.Accepted);
            bookingId = booking.Id;
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "owner-1", [ApplicationRoles.HallOwner]);

            await service.PublishBookingAsync(hallId, bookingId);

            var availability = context.HallAvailabilities.AsNoTracking().Single(a =>
                a.HallId == hallId && a.Date == BookingDate && a.PeriodType == BookingPeriodType.FirstPeriod);
            Assert.Equal(AvailabilityStatus.Booked, availability.Status);
        }
    }

    [Fact]
    public async Task Publish_ExcludesPublishedPeriodFromPublicAvailability()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid bookingId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingPeriodType.FirstPeriod, BookingStatus.Accepted);
            bookingId = booking.Id;
            SeedAvailability(seedingContext, hall, BookingDate, BookingPeriodType.FirstPeriod, AvailabilityStatus.Booked);
            SeedAvailability(seedingContext, hall, BookingDate, BookingPeriodType.SecondPeriod, AvailabilityStatus.Available);
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "owner-1", [ApplicationRoles.HallOwner]);

            await service.PublishBookingAsync(hallId, bookingId);

            var publiclyAvailable = context.HallAvailabilities
                .AsNoTracking()
                .Where(a => a.Status == AvailabilityStatus.Available)
                .ToList();

            Assert.DoesNotContain(publiclyAvailable, a =>
                a.Date == BookingDate && a.PeriodType == BookingPeriodType.FirstPeriod);
            Assert.Contains(publiclyAvailable, a =>
                a.Date == BookingDate && a.PeriodType == BookingPeriodType.SecondPeriod);
        }
    }

    [Fact]
    public async Task Publish_AnotherOwnersHall_ThrowsForbidden_AndStateUnchanged()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid bookingId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingPeriodType.FirstPeriod, BookingStatus.Accepted);
            bookingId = booking.Id;
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "intruder-owner", [ApplicationRoles.HallOwner]);

            await Assert.ThrowsAsync<ForbiddenException>(() =>
                service.PublishBookingAsync(hallId, bookingId));

            var booking = context.Bookings.AsNoTracking().Single(b => b.Id == bookingId);
            Assert.False(booking.IsPublished);
            Assert.Equal(BookingStatus.Accepted, booking.Status);
        }
    }

    [Fact]
    public async Task Publish_PendingBooking_ThrowsConflict_AndStateUnchanged()
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
            var service = CreateService(context, "owner-1", [ApplicationRoles.HallOwner]);

            await Assert.ThrowsAsync<ConflictException>(() =>
                service.PublishBookingAsync(hallId, bookingId));

            var booking = context.Bookings.AsNoTracking().Single(b => b.Id == bookingId);
            Assert.Equal(BookingStatus.Pending, booking.Status);
            Assert.False(booking.IsPublished);
        }
    }

    [Fact]
    public async Task Publish_AlreadyPublished_ThrowsConflict_AndStateUnchanged()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid bookingId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingPeriodType.FirstPeriod, BookingStatus.Accepted, isPublished: true);
            bookingId = booking.Id;
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "owner-1", [ApplicationRoles.HallOwner]);

            await Assert.ThrowsAsync<ConflictException>(() =>
                service.PublishBookingAsync(hallId, bookingId));

            var booking = context.Bookings.AsNoTracking().Single(b => b.Id == bookingId);
            Assert.True(booking.IsPublished);
            Assert.Equal(BookingStatus.Accepted, booking.Status);
        }
    }

    [Fact]
    public async Task Publish_CompetingActiveClaim_ThrowsConflict_AndAvailabilityUntouched()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid bookingId;
        Guid availabilityId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingPeriodType.FirstPeriod, BookingStatus.Accepted);
            bookingId = booking.Id;
            SeedBooking(seedingContext, hall, "user-2", BookingDate, BookingPeriodType.FirstPeriod);
            var availability = SeedAvailability(seedingContext, hall, BookingDate, BookingPeriodType.FirstPeriod, AvailabilityStatus.Booked);
            availabilityId = availability.Id;
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "owner-1", [ApplicationRoles.HallOwner]);

            await Assert.ThrowsAsync<ConflictException>(() =>
                service.PublishBookingAsync(hallId, bookingId));

            var booking = context.Bookings.AsNoTracking().Single(b => b.Id == bookingId);
            Assert.False(booking.IsPublished);
            var availability = context.HallAvailabilities.AsNoTracking().Single(a => a.Id == availabilityId);
            Assert.Equal(AvailabilityStatus.Booked, availability.Status);
        }
    }

    [Fact]
    public async Task Publish_KeepsBookingHistory_AndDoesNotTouchOtherBookings()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid bookingId;
        Guid otherBookingId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingPeriodType.FirstPeriod, BookingStatus.Accepted);
            bookingId = booking.Id;
            var other = SeedBooking(seedingContext, hall, "user-2", BookingDate, BookingPeriodType.SecondPeriod);
            otherBookingId = other.Id;
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "owner-1", [ApplicationRoles.HallOwner]);

            await service.PublishBookingAsync(hallId, bookingId);

            var bookings = context.Bookings.AsNoTracking().ToList();
            Assert.Equal(2, bookings.Count);
            Assert.True(bookings.Single(b => b.Id == bookingId).IsPublished);
            var other = bookings.Single(b => b.Id == otherBookingId);
            Assert.False(other.IsPublished);
            Assert.Equal(BookingStatus.Pending, other.Status);
        }
    }

    private static BookingPublishingService CreateService(
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
        BookingStatus status = BookingStatus.Pending,
        bool isPublished = false)
    {
        var booking = new Booking
        {
            HallId = hall.Id,
            RequesterUserId = requesterUserId,
            Date = date,
            Period = period,
            Status = status,
            IsPublished = isPublished
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
            Date = date,
            PeriodType = periodType,
            Status = status
        };

        context.HallAvailabilities.Add(availability);
        context.SaveChanges();

        return availability;
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