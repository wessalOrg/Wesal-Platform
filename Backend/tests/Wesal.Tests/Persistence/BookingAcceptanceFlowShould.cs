using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.InMemory;
using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Application.Common.Models;
using Wesal.Infrastructure.Bookings;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Persistence;

public class BookingAcceptanceFlowShould
{
    private static readonly DateOnly BookingDate = new(2035, 6, 1);
    private static readonly TimeOnly BookingStart = new(10, 0);

    [Fact]
    public async Task Accept_PendingBooking_PersistsAcceptedWithDeposit_AndLeavesHourReserved()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid bookingId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingStart);
            bookingId = booking.Id;
            // WESAL-TASK-8 (Edit 8): a live request holds its hour as Reserved, not Booked.
            SeedSlotAvailability(seedingContext, hall, BookingDate, BookingStart, HallSlotStatus.Reserved);
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "owner-1", [ApplicationRoles.HallOwner]);

            var result = await service.AcceptBookingAsync(hallId, bookingId, Approval(750m));

            Assert.Equal(bookingId, result.BookingId);
            Assert.Equal(hallId, result.HallId);
            Assert.Equal("user-1", result.RequesterUserId);
            Assert.Equal(BookingDate, result.Date);
            Assert.Equal(BookingStart, Assert.Single(result.SlotStarts));
            Assert.Equal(BookingStatus.Accepted, result.Status);
            Assert.Equal(750m, result.DepositAmount);

            var booking = context.Bookings
                .AsNoTracking()
                .Include(candidate => candidate.Slots)
                .Single(candidate => candidate.Id == bookingId);
            Assert.Equal(BookingStatus.Accepted, booking.Status);
            Assert.Equal(hallId, booking.HallId);
            Assert.Equal("user-1", booking.RequesterUserId);
            Assert.Equal(BookingDate, booking.Date);
            Assert.Equal(BookingStart, Assert.Single(booking.Slots).StartTime);
            Assert.Equal(750m, booking.DepositAmount);

            // The money has not been confirmed, so the hours must still be held rather than
            // booked. Booking them here is exactly the behaviour this change removes.
            Assert.Null(booking.DepositPaymentConfirmedAt);

            var availability = context.HallSlotAvailabilities.AsNoTracking().Single(candidate =>
                candidate.HallId == hallId
                && candidate.Date == BookingDate
                && candidate.StartTime == BookingStart);
            Assert.Equal(HallSlotStatus.Reserved, availability.Status);
        }
    }

    [Fact]
    public async Task Accept_WritesTheApprovalNoticeToTheRequesterConversation()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();
        Guid bookingId;

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingStart);
            bookingId = booking.Id;
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "owner-1", [ApplicationRoles.HallOwner]);

            var result = await service.AcceptBookingAsync(hallId, bookingId, Approval(750m));

            Assert.Equal(BookingAcceptanceNotificationStatus.Delivered, result.NotificationStatus);

            var message = Assert.Single(context.Messages.AsNoTracking());
            Assert.Equal("owner-1", message.SenderUserId);
            Assert.Contains("750", message.Content);

            // The requester/owner conversation is created on demand, so the notice and any
            // later payment proof share one thread.
            var conversation = Assert.Single(context.Conversations.AsNoTracking());
            Assert.Equal(hallId, conversation.HallId);
            Assert.Equal("user-1", conversation.SenderUserId);
            Assert.Equal("owner-1", conversation.HallOwnerId);
            Assert.Equal(conversation.Id, message.ConversationId);
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
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingStart);
            bookingId = booking.Id;
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "intruder-owner", [ApplicationRoles.HallOwner]);

            await Assert.ThrowsAsync<ForbiddenException>(() =>
                service.AcceptBookingAsync(hallId, bookingId, Approval()));

            var booking = context.Bookings.AsNoTracking().Single(candidate => candidate.Id == bookingId);
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
            var booking = SeedBooking(
                seedingContext,
                hall,
                "user-1",
                BookingDate,
                BookingStart,
                BookingStatus.Rejected);
            bookingId = booking.Id;
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "owner-1", [ApplicationRoles.HallOwner]);

            await Assert.ThrowsAsync<ConflictException>(() =>
                service.AcceptBookingAsync(hallId, bookingId, Approval()));

            var booking = context.Bookings.AsNoTracking().Single(candidate => candidate.Id == bookingId);
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
            var booking = SeedBooking(
                seedingContext,
                hall,
                "user-1",
                BookingDate,
                BookingStart,
                BookingStatus.Cancelled);
            bookingId = booking.Id;
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "owner-1", [ApplicationRoles.HallOwner]);

            await Assert.ThrowsAsync<ConflictException>(() =>
                service.AcceptBookingAsync(hallId, bookingId, Approval()));

            var booking = context.Bookings.AsNoTracking().Single(candidate => candidate.Id == bookingId);
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
            var booking = SeedBooking(seedingContext, hall, "user-1", BookingDate, BookingStart);
            bookingId = booking.Id;
        }

        await using (var cancelContext = CreateContext(databaseName))
        {
            var cancelRows = await new BookingRepository(cancelContext).CancelPendingAsync(bookingId, "user-1");
            Assert.Equal(1, cancelRows);
        }

        await using (var acceptContext = CreateContext(databaseName))
        {
            var service = CreateService(acceptContext, "owner-1", [ApplicationRoles.HallOwner]);

            var exception = await Assert.ThrowsAsync<ConflictException>(() =>
                service.AcceptBookingAsync(hallId, bookingId, Approval()));

            Assert.Contains("cancelled", exception.Message, StringComparison.OrdinalIgnoreCase);
        }

        await using (var readContext = CreateContext(databaseName))
        {
            var booking = readContext.Bookings.AsNoTracking().Single(candidate => candidate.Id == bookingId);
            Assert.Equal(BookingStatus.Cancelled, booking.Status);
        }
    }

    private static AcceptBookingRequestDto Approval(decimal amount = 500m)
        => new() { DepositAmount = amount };

    private static BookingAcceptanceService CreateService(
        ApplicationDbContext context,
        string userId,
        string[] roles)
        => new(
            new BookingRepository(context),
            new ConversationRepository(context),
            new MessageRepository(context),
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
        TimeOnly startTime,
        BookingStatus status = BookingStatus.Pending)
    {
        var booking = new Booking
        {
            HallId = hall.Id,
            RequesterUserId = requesterUserId,
            Date = date,
            Slots =
            [
                new BookingSlot
                {
                    StartTime = startTime,
                    EndTime = startTime.AddHours(1)
                }
            ],
            Status = status
        };

        context.Bookings.Add(booking);
        context.SaveChanges();

        return booking;
    }

    private static void SeedSlotAvailability(
        ApplicationDbContext context,
        Hall hall,
        DateOnly date,
        TimeOnly startTime,
        HallSlotStatus status)
    {
        context.HallSlotAvailabilities.Add(new HallSlotAvailability
        {
            HallId = hall.Id,
            Date = date,
            StartTime = startTime,
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
