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

public class BookingDeletionFlowShould
{
    private static readonly DateOnly BookingDate = new(2035, 6, 1);

    [Fact]
    public async Task Delete_PendingBooking_PermanentlyRemovesAndReleasesExactPeriod_OthersUntouched()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid bookingId;
        Guid otherBookingId;
        Guid availabilityId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingPeriodType.FirstPeriod);
            bookingId = booking.Id;
            var other = SeedBooking(seedingContext, hall, "user-2", BookingDate, BookingPeriodType.SecondPeriod);
            otherBookingId = other.Id;
            var availability = SeedAvailability(seedingContext, hall, BookingDate, BookingPeriodType.FirstPeriod, AvailabilityStatus.Booked);
            availabilityId = availability.Id;
            SeedAvailability(seedingContext, hall, BookingDate, BookingPeriodType.SecondPeriod, AvailabilityStatus.Booked);
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "owner-1", [ApplicationRoles.HallOwner]);

            var result = await service.DeleteBookingAsync(hallId, bookingId);

            Assert.Equal(bookingId, result.BookingId);
            Assert.Equal(hallId, result.HallId);
            Assert.Equal("user-1", result.RequesterUserId);
            Assert.Equal(BookingDate, result.Date);
            Assert.Equal(BookingPeriodType.FirstPeriod, result.Period);
            Assert.Equal(BookingStatus.Pending, result.Status);
            Assert.False(result.IsPublished);

            Assert.Null(context.Bookings.AsNoTracking().SingleOrDefault(b => b.Id == bookingId));
            var remaining = Assert.Single(context.Bookings.AsNoTracking());
            Assert.Equal(otherBookingId, remaining.Id);

            var released = context.HallAvailabilities.AsNoTracking().Single(a => a.Id == availabilityId);
            Assert.Equal(AvailabilityStatus.Available, released.Status);
            Assert.Equal(AvailabilityStatus.Booked, context.HallAvailabilities
                .AsNoTracking()
                .Single(a => a.PeriodType == BookingPeriodType.SecondPeriod)
                .Status);
        }
    }

    [Fact]
    public async Task Delete_AcceptedPublishedBooking_ClearsPublicBooked()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid bookingId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingPeriodType.FirstPeriod, BookingStatus.Accepted, isPublished: true);
            bookingId = booking.Id;
            SeedAvailability(seedingContext, hall, BookingDate, BookingPeriodType.FirstPeriod, AvailabilityStatus.Booked);
            SeedAvailability(seedingContext, hall, BookingDate, BookingPeriodType.SecondPeriod, AvailabilityStatus.Booked);
            SeedAvailability(seedingContext, hall, new DateOnly(2035, 6, 2), BookingPeriodType.FirstPeriod, AvailabilityStatus.Booked);
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "owner-1", [ApplicationRoles.HallOwner]);

            var result = await service.DeleteBookingAsync(hallId, bookingId);

            Assert.True(result.IsPublished);

            Assert.Null(context.Bookings.AsNoTracking().SingleOrDefault(b => b.Id == bookingId));

            var publiclyAvailable = context.HallAvailabilities
                .AsNoTracking()
                .Where(a => a.Status == AvailabilityStatus.Available)
                .ToList();

            Assert.Contains(publiclyAvailable, a =>
                a.Date == BookingDate && a.PeriodType == BookingPeriodType.FirstPeriod);
            Assert.DoesNotContain(publiclyAvailable, a =>
                a.Date == BookingDate && a.PeriodType == BookingPeriodType.SecondPeriod);
            Assert.DoesNotContain(publiclyAvailable, a => a.Date == new DateOnly(2035, 6, 2));
        }
    }

    [Fact]
    public async Task Delete_AnotherOwnersBooking_ThrowsForbidden_AndStateUnchanged()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid bookingId;
        Guid availabilityId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingPeriodType.FirstPeriod);
            bookingId = booking.Id;
            var availability = SeedAvailability(seedingContext, hall, BookingDate, BookingPeriodType.FirstPeriod, AvailabilityStatus.Booked);
            availabilityId = availability.Id;
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "intruder-owner", [ApplicationRoles.HallOwner]);

            await Assert.ThrowsAsync<ForbiddenException>(() =>
                service.DeleteBookingAsync(hallId, bookingId));

            Assert.NotNull(context.Bookings.AsNoTracking().SingleOrDefault(b => b.Id == bookingId));
            Assert.Equal(AvailabilityStatus.Booked, context.HallAvailabilities.AsNoTracking().Single(a => a.Id == availabilityId).Status);
        }
    }

    [Fact]
    public async Task Delete_BookingOfAnotherHall_ThrowsNotFound()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid otherHallId;
        Guid bookingId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            var otherHall = SeedHall(seedingContext, Guid.NewGuid());
            otherHallId = otherHall.Id;
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingPeriodType.FirstPeriod);
            bookingId = booking.Id;
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "owner-1", [ApplicationRoles.HallOwner]);

            await Assert.ThrowsAsync<NotFoundException>(() =>
                service.DeleteBookingAsync(otherHallId, bookingId));

            Assert.NotNull(context.Bookings.AsNoTracking().SingleOrDefault(b => b.Id == bookingId));
        }
    }

    [Fact]
    public async Task Delete_DeletedHallBooking_ThrowsNotFound()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid bookingId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            hall.IsDeleted = true;
            seedingContext.SaveChanges();
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingPeriodType.FirstPeriod);
            bookingId = booking.Id;
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "owner-1", [ApplicationRoles.HallOwner]);

            await Assert.ThrowsAsync<NotFoundException>(() =>
                service.DeleteBookingAsync(hallId, bookingId));

            Assert.NotNull(context.Bookings.AsNoTracking().SingleOrDefault(b => b.Id == bookingId));
        }
    }

    [Fact]
    public async Task Delete_WithAnotherActiveBooking_SkipsRelease()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid bookingId;
        Guid competingBookingId;
        Guid availabilityId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingPeriodType.FirstPeriod);
            bookingId = booking.Id;
            var competing = SeedBooking(seedingContext, hall, "user-2", BookingDate, BookingPeriodType.FirstPeriod);
            competingBookingId = competing.Id;
            var availability = SeedAvailability(seedingContext, hall, BookingDate, BookingPeriodType.FirstPeriod, AvailabilityStatus.Booked);
            availabilityId = availability.Id;
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "owner-1", [ApplicationRoles.HallOwner]);

            await service.DeleteBookingAsync(hallId, bookingId);

            Assert.Null(context.Bookings.AsNoTracking().SingleOrDefault(b => b.Id == bookingId));
            Assert.NotNull(context.Bookings.AsNoTracking().SingleOrDefault(b => b.Id == competingBookingId));
            Assert.Equal(AvailabilityStatus.Booked, context.HallAvailabilities.AsNoTracking().Single(a => a.Id == availabilityId).Status);
        }
    }

    [Fact]
    public async Task Delete_RemovesPendingRejectionNotificationSource()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid bookingId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingPeriodType.FirstPeriod, BookingStatus.Rejected);
            booking.RejectionReason = "Not available";
            booking.RejectionMessageId = null;
            seedingContext.SaveChanges();
            bookingId = booking.Id;
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "owner-1", [ApplicationRoles.HallOwner]);
            var repository = new BookingRepository(context);

            await service.DeleteBookingAsync(hallId, bookingId);

            var pending = await repository.GetPendingRejectionNotificationsAsync();
            Assert.DoesNotContain(pending, b => b.Id == bookingId);
            Assert.Null(context.Bookings.AsNoTracking().SingleOrDefault(b => b.Id == bookingId));
        }
    }

    [Fact]
    public async Task Delete_KeepsRejectionMessageAndConversationHistory()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid bookingId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            var conversation = SeedConversation(seedingContext, hall);
            var message = SeedMessage(seedingContext, conversation);
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingPeriodType.FirstPeriod, BookingStatus.Rejected);
            booking.RejectionMessageId = message.Id;
            seedingContext.SaveChanges();
            bookingId = booking.Id;
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "owner-1", [ApplicationRoles.HallOwner]);

            await service.DeleteBookingAsync(hallId, bookingId);

            Assert.Null(context.Bookings.AsNoTracking().SingleOrDefault(b => b.Id == bookingId));
            Assert.Single(context.Conversations.AsNoTracking());
            Assert.Single(context.Messages.AsNoTracking());
        }
    }

    [Fact]
    public async Task Delete_SequentialSecondDelete_ThrowsNotFound()
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

            await service.DeleteBookingAsync(hallId, bookingId);

            await Assert.ThrowsAsync<NotFoundException>(() =>
                service.DeleteBookingAsync(hallId, bookingId));
        }
    }

    [Fact]
    public async Task Delete_KeepsOtherHallsAndTheirBookingsUntouched()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid otherHallId;
        Guid otherHallBookingId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingPeriodType.FirstPeriod);
            var otherHall = SeedHall(seedingContext, Guid.NewGuid());
            otherHallId = otherHall.Id;
            var otherHallBooking = SeedBooking(seedingContext, otherHall, "user-3", BookingDate, BookingPeriodType.FirstPeriod);
            otherHallBookingId = otherHallBooking.Id;
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "owner-1", [ApplicationRoles.HallOwner]);

            var bookingsAtStart = context.Bookings.AsNoTracking().Count();
            await service.DeleteBookingAsync(hallId, context.Bookings.AsNoTracking().First(b => b.HallId == hallId).Id);

            Assert.Equal(bookingsAtStart - 1, context.Bookings.AsNoTracking().Count());
            Assert.NotNull(context.Bookings.AsNoTracking().SingleOrDefault(b => b.Id == otherHallBookingId));
            Assert.Equal(2, context.Halls.AsNoTracking().Count());
        }
    }

    [Fact]
    public async Task Delete_AdminRole_IsForbiddenEvenWhenOwned()
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
            var service = CreateService(context, "owner-1", [ApplicationRoles.Admin]);

            await Assert.ThrowsAsync<ForbiddenException>(() =>
                service.DeleteBookingAsync(hallId, bookingId));

            Assert.NotNull(context.Bookings.AsNoTracking().SingleOrDefault(b => b.Id == bookingId));
        }
    }

    private static BookingDeletionService CreateService(
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
            Name = $"Grand Hall {id}",
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
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            Hall = hall,
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

    private static Conversation SeedConversation(ApplicationDbContext context, Hall hall)
    {
        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            Hall = hall,
            SenderUserId = "user-1",
            HallOwnerId = "owner-1"
        };

        context.Conversations.Add(conversation);
        context.SaveChanges();

        return conversation;
    }

    private static Message SeedMessage(ApplicationDbContext context, Conversation conversation)
    {
        var message = new Message
        {
            Id = Guid.NewGuid(),
            ConversationId = conversation.Id,
            Conversation = conversation,
            SenderUserId = "owner-1",
            Content = "Your booking request was rejected by the hall owner."
        };

        context.Messages.Add(message);
        context.SaveChanges();

        return message;
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