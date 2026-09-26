using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Bookings;
using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Owner approval flow, WESAL-TASK-8 (Edit 8). Approval now requires a deposit and stops
/// short of booking: the hours stay Reserved until the owner confirms the payment, and
/// the requester is told how much to pay. The authorization, state-eligibility, race and
/// rollback guarantees of the previous behaviour are all still asserted here.
/// </summary>
public class BookingAcceptanceServiceShould
{
    private const string HallOwnerId = "owner-1";
    private const string RequesterId = "user-1";
    private const decimal Deposit = 500m;

    private static AcceptBookingRequestDto Approval(decimal amount = Deposit)
        => new() { DepositAmount = amount };

    [Fact]
    public async Task AcceptBooking_OwnPendingBooking_ReturnsAcceptedResult()
    {
        var scenario = Scenario();

        var result = await scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval());

        Assert.Equal(scenario.Booking.Id, result.BookingId);
        Assert.Equal(scenario.Hall.Id, result.HallId);
        Assert.Equal(scenario.Hall.Name, result.HallName);
        Assert.Equal(RequesterId, result.RequesterUserId);
        Assert.Equal(new DateOnly(2035, 6, 1), result.Date);
        Assert.Equal(new TimeOnly(10, 0), Assert.Single(result.SlotStarts));
        Assert.Equal(BookingStatus.Accepted, result.Status);
    }

    [Fact]
    public async Task AcceptBooking_OwnPendingBooking_SetsStatusToAccepted()
    {
        var scenario = Scenario();

        await scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval());

        Assert.Equal(BookingStatus.Accepted, scenario.Booking.Status);
    }

    [Fact]
    public async Task AcceptBooking_PreservesRequesterHallDateAndSlots()
    {
        var scenario = Scenario();

        await scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval());

        Assert.Equal(RequesterId, scenario.Booking.RequesterUserId);
        Assert.Equal(scenario.Hall.Id, scenario.Booking.HallId);
        Assert.Equal(new DateOnly(2035, 6, 1), scenario.Booking.Date);
        Assert.Equal(new TimeOnly(10, 0), Assert.Single(scenario.Booking.Slots).StartTime);
    }

    // ---------------------------------------------------------------------------------
    // WESAL-TASK-8 (Edit 8): the deposit
    // ---------------------------------------------------------------------------------

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(0.009)]
    public async Task AcceptBooking_DepositBelowMinimum_ThrowsValidation(decimal amount)
    {
        var scenario = Scenario();

        await Assert.ThrowsAsync<ValidationException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval(amount)));

        // Nothing may be persisted for a rejected approval, least of all a status flip.
        Assert.Equal(BookingStatus.Pending, scenario.Booking.Status);
        Assert.Null(scenario.Booking.DepositAmount);
    }

    [Fact]
    public async Task AcceptBooking_DepositAboveMaximum_ThrowsValidation()
    {
        var scenario = Scenario();

        await Assert.ThrowsAsync<ValidationException>(() =>
            scenario.Service.AcceptBookingAsync(
                scenario.Hall.Id,
                scenario.Booking.Id,
                Approval(BookingDeposits.MaximumAmount + 1)));

        Assert.Equal(BookingStatus.Pending, scenario.Booking.Status);
    }

    [Fact]
    public async Task AcceptBooking_MissingDeposit_ThrowsValidation()
    {
        var scenario = Scenario();

        // A body-less approval - the call shape that used to be valid - is no longer a
        // complete approval, so it is refused instead of defaulting the amount to zero.
        await Assert.ThrowsAsync<ValidationException>(() =>
            scenario.Service.AcceptBookingAsync(
                scenario.Hall.Id,
                scenario.Booking.Id,
                new AcceptBookingRequestDto { DepositAmount = 0m }));

        Assert.Equal(BookingStatus.Pending, scenario.Booking.Status);
    }

    [Theory]
    [InlineData(0.01)]
    [InlineData(500)]
    [InlineData(1000000)]
    public async Task AcceptBooking_DepositInsideAllowedRange_PersistsAmount(decimal amount)
    {
        var scenario = Scenario();

        var result = await scenario.Service.AcceptBookingAsync(
            scenario.Hall.Id,
            scenario.Booking.Id,
            Approval(amount));

        Assert.Equal(amount, result.DepositAmount);
        Assert.Equal(amount, scenario.Booking.DepositAmount);
    }

    // ---------------------------------------------------------------------------------
    // WESAL-TASK-8 (Edit 8): approval must not book the hall
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task AcceptBooking_LeavesHoursReserved_AndDoesNotBookThem()
    {
        var scenario = Scenario();

        await scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval());

        // Neither the confirmation trigger nor the old "re-assert as Booked" call may run
        // here. Booking the hours is the payment-confirmation step's job alone.
        Assert.Empty(scenario.BookingRepository.ConfirmedSlotCalls);
        Assert.Empty(scenario.BookingRepository.ReservedSlotCalls);
    }

    [Fact]
    public async Task AcceptBooking_DoesNotStampPaymentConfirmation()
    {
        var scenario = Scenario();

        await scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval());

        Assert.Null(scenario.Booking.DepositPaymentConfirmedAt);
    }

    // ---------------------------------------------------------------------------------
    // WESAL-TASK-8 (Edit 8): the requester notice
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task AcceptBooking_NotifiesRequesterOnTheBookingConversation()
    {
        var scenario = Scenario();

        var result = await scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval());

        Assert.Equal(BookingAcceptanceNotificationStatus.Delivered, result.NotificationStatus);

        var message = Assert.Single(scenario.Messages.Messages);
        Assert.Equal(HallOwnerId, message.SenderUserId);
        Assert.Contains("500", message.Content);

        // The notice must live on the requester/owner conversation so tapping it opens the
        // same thread used for rejection and for the requester's payment proof.
        var conversation = Assert.Single(scenario.Conversations.Conversations);
        Assert.Equal(scenario.Hall.Id, conversation.HallId);
        Assert.Equal(RequesterId, conversation.SenderUserId);
        Assert.Equal(HallOwnerId, conversation.HallOwnerId);
        Assert.Equal(conversation.Id, message.ConversationId);
    }

    [Fact]
    public async Task AcceptBooking_ReusesTheExistingConversation_InsteadOfCreatingAnother()
    {
        var scenario = Scenario();
        scenario.Conversations.Conversations.Add(new Conversation
        {
            HallId = scenario.Hall.Id,
            SenderUserId = RequesterId,
            HallOwnerId = HallOwnerId
        });

        await scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval());

        Assert.Single(scenario.Conversations.Conversations);
        Assert.Single(scenario.Messages.Messages);
    }

    [Fact]
    public async Task AcceptBooking_NoticeDeliveryFailure_StillApproves_AndReportsDeferred()
    {
        var scenario = Scenario();
        scenario.FailMessageWrites = true;

        var result = await scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval());

        // The approval itself must survive a notification problem, and the caller is told
        // the notice is outstanding rather than being handed a false success.
        Assert.Equal(BookingStatus.Accepted, scenario.Booking.Status);
        Assert.Equal(Deposit, scenario.Booking.DepositAmount);
        Assert.Equal(BookingAcceptanceNotificationStatus.Deferred, result.NotificationStatus);
        Assert.Null(scenario.Booking.ApprovalMessageId);
    }

    [Fact]
    public async Task AcceptBooking_AlreadyNotified_IsNotNotifiedTwice()
    {
        var scenario = Scenario();
        scenario.Booking.ApprovalMessageId = Guid.NewGuid();

        var result = await scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval());

        Assert.Empty(scenario.Messages.Messages);
        Assert.Equal(BookingAcceptanceNotificationStatus.Delivered, result.NotificationStatus);
    }

    [Fact]
    public async Task DeliverPendingAcceptanceNotifications_RetriesAPendingNotice()
    {
        var scenario = Scenario();
        await scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval());

        // Simulate a notice that was never delivered: the booking stays Approved with no
        // message recorded, exactly as it looks after a failed attempt.
        scenario.Booking.ApprovalMessageId = null;
        scenario.Conversations.Conversations.Clear();
        scenario.Messages.Messages.Clear();
        scenario.BookingRepository.PendingAcceptanceNotifications.Add(scenario.Booking);

        var delivered = await scenario.Service.DeliverPendingAcceptanceNotificationsAsync();

        Assert.Equal(1, delivered);
        Assert.Single(scenario.Messages.Messages);
        Assert.NotNull(scenario.Booking.ApprovalMessageId);
    }

    [Fact]
    public async Task DeliverPendingAcceptanceNotifications_SkipsAlreadyDeliveredNotices()
    {
        var scenario = Scenario();
        await scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval());
        scenario.BookingRepository.PendingAcceptanceNotifications.Add(scenario.Booking);
        scenario.Messages.Messages.Clear();

        var delivered = await scenario.Service.DeliverPendingAcceptanceNotificationsAsync();

        Assert.Equal(0, delivered);
        Assert.Empty(scenario.Messages.Messages);
    }

    // ---------------------------------------------------------------------------------
    // Authorization, state eligibility, races and rollback (unchanged guarantees)
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task AcceptBooking_Unauthenticated_ThrowsUnauthorized()
    {
        var scenario = Scenario(userId: null);

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval()));
    }

    [Fact]
    public async Task AcceptBooking_RegisteredUser_ThrowsForbidden()
    {
        var scenario = Scenario(userId: RequesterId, roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval()));
    }

    [Fact]
    public async Task AcceptBooking_Admin_ThrowsForbidden()
    {
        var scenario = Scenario(userId: "admin-1", roles: [ApplicationRoles.Admin]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval()));
    }

    [Fact]
    public async Task AcceptBooking_AnotherOwner_ThrowsForbidden()
    {
        var scenario = Scenario(userId: "owner-2", roles: [ApplicationRoles.HallOwner]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval()));
    }

    [Fact]
    public async Task AcceptBooking_UnknownBooking_ThrowsNotFound()
    {
        var scenario = Scenario();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, Guid.NewGuid(), Approval()));
    }

    [Fact]
    public async Task AcceptBooking_WrongHallId_ThrowsNotFound()
    {
        var scenario = Scenario();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            scenario.Service.AcceptBookingAsync(Guid.NewGuid(), scenario.Booking.Id, Approval()));
    }

    [Fact]
    public async Task AcceptBooking_DeletedHall_ThrowsNotFound()
    {
        var scenario = Scenario();
        scenario.Hall.IsDeleted = true;

        await Assert.ThrowsAsync<NotFoundException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval()));
    }

    [Fact]
    public async Task AcceptBooking_AlreadyAccepted_ThrowsConflict()
    {
        var scenario = Scenario();
        scenario.Booking.Status = BookingStatus.Accepted;

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval()));
    }

    [Fact]
    public async Task AcceptBooking_RejectedBooking_ThrowsConflict()
    {
        var scenario = Scenario();
        scenario.Booking.Status = BookingStatus.Rejected;

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval()));
    }

    [Fact]
    public async Task AcceptBooking_CancelledBooking_ThrowsConflict()
    {
        var scenario = Scenario();
        scenario.Booking.Status = BookingStatus.Cancelled;

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval()));
    }

    [Fact]
    public async Task AcceptBooking_RaceLost_ThrowsConflict_WithoutSideEffects()
    {
        var scenario = Scenario();
        scenario.BookingRepository.ForceZeroConditionalUpdate = true;

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval()));

        Assert.Equal(BookingStatus.Pending, scenario.Booking.Status);
        Assert.Null(scenario.Booking.DepositAmount);
        Assert.False(scenario.BookingRepository.AcceptedAgainstCancelled);
    }

    [Fact]
    public async Task AcceptBooking_StorageFailure_RollsBackStatusToPending()
    {
        var scenario = Scenario();
        scenario.UnitOfWork.ThrowOnSave = true;

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval()));

        Assert.Equal(BookingStatus.Pending, scenario.Booking.Status);
    }

    [Fact]
    public async Task AcceptBooking_ExcludesBookingFromPendingSet_WhileKeepingHistory()
    {
        var scenario = Scenario();

        await scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval());

        var pendingBookings = scenario.BookingRepository.PendingBookings;
        Assert.DoesNotContain(scenario.Booking.Id, pendingBookings.Select(b => b.Id));
        Assert.Contains(scenario.Booking.Id, scenario.Bookings.Select(b => b.Id));
    }

    [Fact]
    public async Task AcceptBooking_RepeatAttempt_ThrowsConflict()
    {
        var scenario = Scenario();

        await scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval());

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id, Approval()));
    }

    private static ScenarioContext Scenario(
        IReadOnlyList<Booking>? bookings = null,
        string? userId = HallOwnerId,
        IReadOnlyList<string>? roles = null)
    {
        var bookingsList = bookings ?? [CreateBooking(Hall(), RequesterId)];

        var context = new ScenarioContext
        {
            BookingRepository = new FakeBookingRepository([.. bookingsList]),
            Conversations = new RecordingConversationRepository(),
            Messages = new RecordingMessageRepository(),
            CurrentUser = CurrentUser(userId, roles ?? [ApplicationRoles.HallOwner]),
            Service = null!
        };

        var unitOfWork = new FakeUnitOfWork(context.BookingRepository.Bookings.ToList());

        context.UnitOfWork = unitOfWork;

        context.Service = new BookingAcceptanceService(
            context.BookingRepository,
            context.Conversations,
            context.Messages,
            unitOfWork,
            context.CurrentUser);

        return context;
    }

    private static FakeCurrentUserService CurrentUser(string? userId, IReadOnlyList<string> roles)
        => new(userId, userId is not null, roles);

    private static Hall Hall()
        => new()
        {
            Id = Guid.NewGuid(),
            Name = "Grand Hall",
            Status = HallStatus.Approved,
            PaymentStatus = HallPaymentStatus.Paid,
            OwnerId = HallOwnerId
        };

    private static Booking CreateBooking(Hall hall, string requesterId, BookingStatus status = BookingStatus.Pending)
        => new()
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            Hall = hall,
            RequesterUserId = requesterId,
            Date = new DateOnly(2035, 6, 1),
            Slots =
            [
                new BookingSlot
                {
                    StartTime = new TimeOnly(10, 0),
                    EndTime = new TimeOnly(11, 0)
                }
            ],
            Status = status
        };

    private sealed class ScenarioContext
    {
        public required FakeBookingRepository BookingRepository { get; init; }

        public required RecordingConversationRepository Conversations { get; init; }

        public required RecordingMessageRepository Messages { get; init; }

        public FakeUnitOfWork UnitOfWork { get; set; } = null!;

        public required FakeCurrentUserService CurrentUser { get; init; }

        public required BookingAcceptanceService Service { get; set; }

        /// <summary>Stands in for a message store that rejects the write, as a full disk would.</summary>
        public bool FailMessageWrites
        {
            get => Messages.FailWrites;
            set => Messages.FailWrites = value;
        }

        public IReadOnlyList<Booking> Bookings => BookingRepository.Bookings;

        public Booking Booking => BookingRepository.Bookings[0];

        public Hall Hall => Booking.Hall;
    }

    private sealed class FakeBookingRepository : IBookingRepository
    {
        private readonly List<Booking> _bookings;

        public FakeBookingRepository(List<Booking> bookings)
        {
            _bookings = bookings;
        }

        public IReadOnlyList<Booking> Bookings => _bookings;

        public IEnumerable<Booking> PendingBookings
            => _bookings.Where(b => b.Status == BookingStatus.Pending);

        public List<Booking> PendingAcceptanceNotifications { get; } = [];

        public bool ForceZeroConditionalUpdate { get; set; }

        public bool AcceptedAgainstCancelled { get; private set; }

        /// <summary>Every claim call, so a test can prove acceptance never re-claims hours.</summary>
        public List<(Guid HallId, DateOnly Date, IReadOnlyList<TimeOnly> SlotStarts)> ReservedSlotCalls { get; } = [];

        /// <summary>Every payment-confirmation call, which must never happen at approval time.</summary>
        public List<(Guid HallId, DateOnly Date, IReadOnlyList<TimeOnly> SlotStarts)> ConfirmedSlotCalls { get; } = [];

        public Task AddAsync(Booking booking, CancellationToken cancellationToken = default)
        {
            _bookings.Add(booking);
            return Task.CompletedTask;
        }

        public Task<Booking?> GetByIdWithHallAsync(Guid bookingId, CancellationToken cancellationToken = default)
            => Task.FromResult(_bookings.FirstOrDefault(b => b.Id == bookingId));

        public Task<IReadOnlyList<Booking>> GetPendingAcceptanceNotificationsAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Booking>>(PendingAcceptanceNotifications);

        public Task<IReadOnlyList<Booking>> GetPendingRejectionNotificationsAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Booking>>([]);

        public Task<int> CancelPendingAsync(
            Guid bookingId,
            string requesterUserId,
            CancellationToken cancellationToken = default)
        {
            var booking = _bookings.FirstOrDefault(b => b.Id == bookingId);

            if (booking is null
                || !string.Equals(booking.RequesterUserId, requesterUserId, StringComparison.Ordinal)
                || (booking.Status != BookingStatus.Pending && booking.Status != BookingStatus.Accepted)
                || booking.DepositPaymentConfirmedAt is not null)
            {
                return Task.FromResult(0);
            }

            booking.Status = BookingStatus.Cancelled;
            return Task.FromResult(1);
        }

        public Task<int> AcceptPendingAsync(
            Guid bookingId,
            decimal depositAmount,
            CancellationToken cancellationToken = default)
        {
            var booking = _bookings.FirstOrDefault(b => b.Id == bookingId);

            if (booking is null
                || booking.Status != BookingStatus.Pending
                || booking.Status == BookingStatus.Cancelled
                || ForceZeroConditionalUpdate)
            {
                AcceptedAgainstCancelled = booking?.Status == BookingStatus.Cancelled;
                return Task.FromResult(0);
            }

            booking.Status = BookingStatus.Accepted;
            booking.DepositAmount = depositAmount;
            return Task.FromResult(1);
        }

        public Task<int> DeleteAsync(Guid bookingId, CancellationToken cancellationToken = default)
        {
            var booking = _bookings.FirstOrDefault(b => b.Id == bookingId);

            if (booking is null)
            {
                return Task.FromResult(0);
            }

            _bookings.Remove(booking);
            return Task.FromResult(1);
        }

        public Task<int> ReserveHourlySlotsAsync(
            Guid hallId,
            DateOnly date,
            IReadOnlyList<TimeOnly> startTimes,
            CancellationToken cancellationToken = default)
        {
            ReservedSlotCalls.Add((hallId, date, startTimes));
            return Task.FromResult(startTimes.Count);
        }

        public Task<int> ConfirmReservedHourlySlotsAsync(
            Guid hallId,
            DateOnly date,
            IReadOnlyList<TimeOnly> startTimes,
            CancellationToken cancellationToken = default)
        {
            ConfirmedSlotCalls.Add((hallId, date, startTimes));
            return Task.FromResult(startTimes.Count);
        }
    }

    private sealed class FakeUnitOfWork : IUnitOfWork
    {
        private readonly List<Booking> _bookings;

        public FakeUnitOfWork(List<Booking>? bookings = null)
        {
            _bookings = bookings ?? [];
        }

        public bool ThrowOnSave { get; set; }

        public bool RolledBack { get; set; }

        public async Task<TResult> ExecuteInTransactionAsync<TResult>(Func<Task<TResult>> operation, CancellationToken cancellationToken = default)
        {
            var snapshot = _bookings
                .Select(b => new BookingStatusSnapshot(b.Id, b.Status, b.DepositAmount))
                .ToList();

            try
            {
                var result = await operation();
                return result;
            }
            catch
            {
                Restore(snapshot);
                RolledBack = true;
                throw;
            }
        }

        public Task ExecuteInTransactionAsync(Func<Task> operation, CancellationToken cancellationToken = default)
            => ExecuteInTransactionAsync<byte>(async () => { await operation(); return 0; }, cancellationToken);

        private void Restore(IReadOnlyList<BookingStatusSnapshot> snapshot)
        {
            foreach (var item in snapshot)
            {
                var booking = _bookings.FirstOrDefault(b => b.Id == item.Id);

                if (booking is not null)
                {
                    booking.Status = item.Status;
                    booking.DepositAmount = item.DepositAmount;
                }
            }
        }

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            if (ThrowOnSave)
            {
                throw new InvalidOperationException("The save failed.");
            }

            return Task.FromResult(1);
        }
    }

    private sealed record BookingStatusSnapshot(Guid Id, BookingStatus Status, decimal? DepositAmount);

    private sealed class FakeCurrentUserService : ICurrentUserService
    {
        public FakeCurrentUserService(string? userId, bool authenticated, IReadOnlyList<string> roles)
        {
            UserId = userId;
            IsAuthenticated = authenticated;
            Roles = roles;
        }

        public string? UserId { get; }
        public string? UserName => null;
        public string? Email => null;
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles { get; }
    }
}
