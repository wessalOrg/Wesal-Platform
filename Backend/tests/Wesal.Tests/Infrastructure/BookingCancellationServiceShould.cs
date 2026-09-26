using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Bookings;

namespace Wesal.Tests.Infrastructure;

public class BookingCancellationServiceShould
{
    private const string HallOwnerId = "owner-1";
    private const string RequesterId = "user-1";

    [Fact]
    public async Task CancelBooking_OwnPendingBooking_ReturnsCancelledResult()
    {
        var scenario = Scenario();

        var result = await scenario.Service.CancelBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        Assert.Equal(scenario.Booking.Id, result.BookingId);
        Assert.Equal(scenario.Hall.Id, result.HallId);
        Assert.Equal(scenario.Hall.Name, result.HallName);
        Assert.Equal(RequesterId, result.RequesterUserId);
        Assert.Equal(new DateOnly(2035, 6, 1), result.Date);
        Assert.Equal(new TimeOnly(10, 0), Assert.Single(result.SlotStarts));
        Assert.Equal(BookingStatus.Cancelled, result.Status);
    }

    [Fact]
    public async Task CancelBooking_OwnPendingBooking_SetsStatusToCancelled()
    {
        var scenario = Scenario();

        await scenario.Service.CancelBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        Assert.Equal(BookingStatus.Cancelled, scenario.Booking.Status);
    }

    [Fact]
    public async Task CancelBooking_PreservesRequesterHallDateAndPeriod()
    {
        var scenario = Scenario();

        await scenario.Service.CancelBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        Assert.Single(scenario.Bookings);
        Assert.Equal(RequesterId, scenario.Booking.RequesterUserId);
        Assert.Equal(scenario.Hall.Id, scenario.Booking.HallId);
        Assert.Equal(new DateOnly(2035, 6, 1), scenario.Booking.Date);
        Assert.Equal(new TimeOnly(10, 0), Assert.Single(scenario.Booking.Slots).StartTime);
    }

    [Fact]
    public async Task CancelBooking_Unauthenticated_ThrowsUnauthorized()
    {
        var scenario = Scenario(userId: null);

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            scenario.Service.CancelBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task CancelBooking_HallOwner_ThrowsForbidden()
    {
        var scenario = Scenario(userId: HallOwnerId, roles: [ApplicationRoles.HallOwner]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            scenario.Service.CancelBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task CancelBooking_AdminWithoutOwnershipBypass_ThrowsForbidden()
    {
        var scenario = Scenario(userId: "admin-1", roles: [ApplicationRoles.Admin]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            scenario.Service.CancelBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task CancelBooking_AnotherRegisteredUser_ThrowsForbidden()
    {
        var scenario = Scenario(userId: "user-2", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            scenario.Service.CancelBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task CancelBooking_UnknownBooking_ThrowsNotFound()
    {
        var scenario = Scenario();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            scenario.Service.CancelBookingAsync(scenario.Hall.Id, Guid.NewGuid()));
    }

    [Fact]
    public async Task CancelBooking_WrongHallId_ThrowsNotFound()
    {
        var scenario = Scenario();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            scenario.Service.CancelBookingAsync(Guid.NewGuid(), scenario.Booking.Id));
    }

    [Fact]
    public async Task CancelBooking_DeletedHall_ThrowsNotFound()
    {
        var scenario = Scenario();
        scenario.Hall.IsDeleted = true;

        await Assert.ThrowsAsync<NotFoundException>(() =>
            scenario.Service.CancelBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task CancelBooking_PaidBooking_ThrowsConflict()
    {
        // WESAL-TASK-8 (Edit 8) replaces the old rule "Accepted can never be cancelled" with
        // "only a confirmed deposit locks the booking". See the two Accepted tests at the end
        // of this file for the unpaid/paid pair.
        var scenario = Scenario();
        scenario.Booking.Status = BookingStatus.Accepted;
        scenario.Booking.DepositAmount = 500m;
        scenario.Booking.DepositPaymentConfirmedAt = DateTimeOffset.UtcNow;

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.CancelBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task CancelBooking_RejectedBooking_ThrowsConflict()
    {
        var scenario = Scenario();
        scenario.Booking.Status = BookingStatus.Rejected;

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.CancelBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task CancelBooking_AlreadyCancelledBooking_ThrowsConflict()
    {
        var scenario = Scenario();
        scenario.Booking.Status = BookingStatus.Cancelled;

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.CancelBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task CancelBooking_InformsBothParties_WithSingleMessageInSharedConversation()
    {
        var scenario = Scenario();

        await scenario.Service.CancelBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        var conversation = Assert.Single(scenario.Conversations);
        Assert.Equal(scenario.Hall.Id, conversation.HallId);
        Assert.Equal(RequesterId, conversation.SenderUserId);
        Assert.Equal(HallOwnerId, conversation.HallOwnerId);

        var message = Assert.Single(scenario.Messages);
        Assert.Equal(conversation.Id, message.ConversationId);
        Assert.Equal(RequesterId, message.SenderUserId);
        Assert.Contains(scenario.Hall.Name, message.Content);
        Assert.Contains("2035-06-01", message.Content);
        Assert.Contains("10:00 - 11:00", message.Content);
        Assert.Contains("cancelled", message.Content, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CancelBooking_ReusesExistingConversation_NoDuplicate()
    {
        var scenario = Scenario();
        scenario.Conversations.Add(new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = scenario.Hall.Id,
            SenderUserId = RequesterId,
            HallOwnerId = HallOwnerId
        });

        await scenario.Service.CancelBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        Assert.Single(scenario.Conversations);
        Assert.Single(scenario.Messages);
    }

    [Fact]
    public async Task CancelBooking_CreatesConversation_WhenNoneExists()
    {
        var scenario = Scenario();

        await scenario.Service.CancelBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        Assert.Single(scenario.Conversations);
    }

    [Fact]
    public async Task CancelBooking_ReleasesPeriod_WhenNoOtherActiveBooking()
    {
        var scenario = Scenario();

        await scenario.Service.CancelBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        var released = Assert.Single(scenario.BookingRepository.ReleasedBookings);
        Assert.Equal(scenario.Booking.Id, released);
    }

    [Fact]
    public async Task CancelBooking_DoesNotReleaseSlots_WhenAnotherActiveBookingHoldsThem()
    {
        var hall = Hall();
        var booking = CreateBooking(hall, RequesterId);
        var other = new Booking
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            Hall = hall,
            RequesterUserId = "user-2",
            Date = booking.Date,
            Slots = [new BookingSlot { StartTime = new TimeOnly(10, 0), EndTime = new TimeOnly(11, 0) }],
            Status = BookingStatus.Pending
        };
        var scenario = Scenario([booking, other]);

        await scenario.Service.CancelBookingAsync(scenario.Hall.Id, booking.Id);

        Assert.Equal(BookingStatus.Cancelled, booking.Status);
        Assert.Equal(BookingStatus.Pending, other.Status);
        Assert.Empty(scenario.BookingRepository.ReleasedBookings);
    }

    [Fact]
    public async Task CancelBooking_OnlyReleasesOwnPeriod_OtherPeriodKept()
    {
        var hall = Hall();
        var booking = CreateBooking(hall, RequesterId);
        var other = new Booking
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            Hall = hall,
            RequesterUserId = "user-2",
            Date = booking.Date,
            Slots =
            [
                new BookingSlot
                {
                    StartTime = new TimeOnly(11, 0),
                    EndTime = new TimeOnly(12, 0)
                }
            ],
            Status = BookingStatus.Pending
        };
        var scenario = Scenario([booking, other]);

        await scenario.Service.CancelBookingAsync(scenario.Hall.Id, booking.Id);

        var released = Assert.Single(scenario.BookingRepository.ReleasedBookings);
        Assert.Equal(booking.Id, released);
        Assert.Equal(BookingStatus.Pending, other.Status);
    }

    [Fact]
    public async Task CancelBooking_RejectedBookingsDoNotHoldThePeriod()
    {
        var scenario = Scenario();
        scenario.BookingRepository.AddAnother(CreateBooking(scenario.Hall, "user-2", BookingStatus.Rejected));

        await scenario.Service.CancelBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        Assert.Single(scenario.BookingRepository.ReleasedBookings);
    }

    [Fact]
    public async Task CancelBooking_RaceLost_ThrowsConflict_WithoutSideEffects()
    {
        var scenario = Scenario();
        scenario.BookingRepository.ForceZeroConditionalUpdate = true;

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.CancelBookingAsync(scenario.Hall.Id, scenario.Booking.Id));

        Assert.Equal(BookingStatus.Pending, scenario.Booking.Status);
        Assert.Empty(scenario.Messages);
        Assert.Empty(scenario.BookingRepository.ReleasedBookings);
    }

    [Fact]
    public async Task CancelBooking_StorageFailure_RollsBackStatusToPending_AndNoMessage()
    {
        var scenario = Scenario();
        scenario.UnitOfWork.ThrowOnSave = true;

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            scenario.Service.CancelBookingAsync(scenario.Hall.Id, scenario.Booking.Id));

        Assert.Equal(BookingStatus.Pending, scenario.Booking.Status);
        Assert.Empty(scenario.Messages);
    }

    [Fact]
    public async Task CancelBooking_ExcludesBookingFromPendingSet_WhileKeepingHistory()
    {
        var scenario = Scenario();

        await scenario.Service.CancelBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        var pendingBookings = scenario.BookingRepository.PendingBookings;
        Assert.DoesNotContain(scenario.Booking.Id, pendingBookings.Select(b => b.Id));
        Assert.Contains(scenario.Booking.Id, scenario.Bookings.Select(b => b.Id));
    }

    [Fact]
    public async Task CancelBooking_RepeatAttempt_ThrowsConflict_WithoutDuplicateMessage()
    {
        var scenario = Scenario();

        await scenario.Service.CancelBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.CancelBookingAsync(scenario.Hall.Id, scenario.Booking.Id));

        Assert.Single(scenario.Messages);
    }

    // ---------------------------------------------------------------------------------
    // WESAL-TASK-8 (Edit 8): the deposit-pending state is cancellable; a paid one is not.
    // ---------------------------------------------------------------------------------

    [Fact]
    public async Task CancelBooking_AcceptedWithUnconfirmedDeposit_SucceedsAndReleasesTheHours()
    {
        var hall = Hall();
        var booking = CreateBooking(hall, RequesterId, BookingStatus.Accepted, depositAmount: 500m);
        var scenario = Scenario([booking]);

        var result = await scenario.Service.CancelBookingAsync(hall.Id, booking.Id);

        // The requester can walk away from an approved booking they never paid for, which is
        // why those hours must come back to the hall rather than stay reserved.
        Assert.Equal(BookingStatus.Cancelled, result.Status);
        Assert.Equal(BookingStatus.Cancelled, booking.Status);
        Assert.Contains(booking.Id, scenario.BookingRepository.ReleasedBookings);
    }

    [Fact]
    public async Task CancelBooking_AcceptedWithConfirmedPayment_ThrowsConflict()
    {
        var hall = Hall();
        var confirmedAt = DateTimeOffset.UtcNow;
        var booking = CreateBooking(
            hall,
            RequesterId,
            BookingStatus.Accepted,
            depositAmount: 500m,
            depositPaymentConfirmedAt: confirmedAt);
        var scenario = Scenario([booking]);

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.CancelBookingAsync(hall.Id, booking.Id));

        // The money has changed hands, so neither the booking nor its hours may move.
        Assert.Equal(BookingStatus.Accepted, booking.Status);
        Assert.Equal(confirmedAt, booking.DepositPaymentConfirmedAt);
        Assert.Empty(scenario.BookingRepository.ReleasedBookings);
    }

    private static ScenarioContext Scenario(
        IReadOnlyList<Booking>? bookings = null,
        string? userId = RequesterId,
        IReadOnlyList<string>? roles = null)
    {
        var bookingsList = bookings ?? [CreateBooking(Hall(), RequesterId)];
        var hall = bookingsList[0].Hall;

        var context = new ScenarioContext
        {
            BookingRepository = new FakeBookingRepository([.. bookingsList]),
            ConversationRepository = new FakeConversationRepository(),
            MessageRepository = new FakeMessageRepository(),
            UnitOfWork = null!,
            CurrentUser = CurrentUser(userId, roles ?? [ApplicationRoles.RegisteredUser]),
            OwnerNotifier = new FakeOwnerBookingRequestNotifier(),
            Service = null!
        };

        context.UnitOfWork = new FakeUnitOfWork(
            context.BookingRepository.Bookings.ToList(),
            context.MessageRepository.CommitPending,
            context.MessageRepository.RollbackPending);

        context.Service = new BookingCancellationService(
            context.BookingRepository,
            context.ConversationRepository,
            context.MessageRepository,
            context.UnitOfWork,
            context.CurrentUser,
            context.OwnerNotifier);

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
            OwnerId = HallOwnerId
        };

    private static Booking CreateBooking(
        Hall hall,
        string requesterId,
        BookingStatus status = BookingStatus.Pending,
        decimal? depositAmount = null,
        DateTimeOffset? depositPaymentConfirmedAt = null)
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
            Status = status,
            DepositAmount = depositAmount,
            DepositPaymentConfirmedAt = depositPaymentConfirmedAt
        };

    private sealed class ScenarioContext
    {
        public required FakeBookingRepository BookingRepository { get; init; }

        public required FakeConversationRepository ConversationRepository { get; init; }

        public required FakeMessageRepository MessageRepository { get; init; }

        public required FakeUnitOfWork UnitOfWork { get; set; }

        public required FakeCurrentUserService CurrentUser { get; init; }

        public required FakeOwnerBookingRequestNotifier OwnerNotifier { get; init; }

        public required BookingCancellationService Service { get; set; }

        public IReadOnlyList<Booking> Bookings => BookingRepository.Bookings;

        public Booking Booking => BookingRepository.Bookings[0];

        public Hall Hall => Booking.Hall;

        public List<Conversation> Conversations => ConversationRepository.Conversations;

        public List<Message> Messages => MessageRepository.Messages;
    }

    private sealed class FakeOwnerBookingRequestNotifier : Wesal.Infrastructure.OwnerDashboard.IOwnerBookingRequestNotifier
    {
        public List<(string OwnerId, OwnerBookingCancellationNotificationEvent Notification)> CancellationsSent { get; } = [];

        public bool ThrowOnNotify { get; set; }

        public Task NotifyBookingRequestReceivedAsync(
            string ownerUserId,
            OwnerBookingRequestNotificationEvent notification,
            CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task NotifyBookingRequestCancelledAsync(
            string ownerUserId,
            OwnerBookingCancellationNotificationEvent notification,
            CancellationToken cancellationToken = default)
        {
            if (ThrowOnNotify)
            {
                throw new InvalidOperationException("The realtime channel failed.");
            }

            CancellationsSent.Add((ownerUserId, notification));
            return Task.CompletedTask;
        }
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

        public bool ForceZeroConditionalUpdate { get; set; }

        public List<Guid> ReleasedBookings { get; } = [];

        public void AddAnother(Booking booking)
        {
            _bookings.Add(booking);
        }

        public Task AddAsync(Booking booking, CancellationToken cancellationToken = default)
        {
            _bookings.Add(booking);
            return Task.CompletedTask;
        }

        public Task<Booking?> GetByIdWithHallAsync(Guid bookingId, CancellationToken cancellationToken = default)
            => Task.FromResult(_bookings.FirstOrDefault(b => b.Id == bookingId));

        public Task<IReadOnlyList<Booking>> GetPendingRejectionNotificationsAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Booking>>([]);

        public Task<int> CancelPendingAsync(
            Guid bookingId,
            string requesterUserId,
            CancellationToken cancellationToken = default)
        {
            var booking = _bookings.FirstOrDefault(b => b.Id == bookingId);

            // WESAL-TASK-8 (Edit 8): mirrors the real conditional UPDATE. An approved booking
            // with the deposit still outstanding is cancellable; a confirmed payment is not.
            if (booking is null
                || !string.Equals(booking.RequesterUserId, requesterUserId, StringComparison.Ordinal)
                || (booking.Status != BookingStatus.Pending && booking.Status != BookingStatus.Accepted)
                || booking.DepositPaymentConfirmedAt is not null
                || ForceZeroConditionalUpdate)
            {
                return Task.FromResult(0);
            }

            booking.Status = BookingStatus.Cancelled;
            return Task.FromResult(1);
        }

        public Task<int> ReleaseBookingSlotsAsync(
            Guid bookingId,
            Guid hallId,
            DateOnly date,
            IReadOnlyList<TimeOnly> slotStarts,
            CancellationToken cancellationToken = default)
        {
            var hasCompetingBooking = _bookings.Any(other =>
                other.Id != bookingId
                && other.HallId == hallId
                && other.Date == date
                && (other.Status == BookingStatus.Pending || other.Status == BookingStatus.Accepted)
                && other.Slots.Any(otherSlot => slotStarts.Contains(otherSlot.StartTime)));

            if (hasCompetingBooking)
            {
                return Task.FromResult(0);
            }

            ReleasedBookings.Add(bookingId);
            return Task.FromResult(slotStarts.Count);
        }

        public Task<int> AcceptPendingAsync(
            Guid bookingId,
            CancellationToken cancellationToken = default)
            => Task.FromResult(0);

        public Task<int> DeleteAsync(
            Guid bookingId,
            CancellationToken cancellationToken = default)
            => Task.FromResult(0);
    }

    private sealed class FakeConversationRepository : IConversationRepository
    {
        public List<Conversation> Conversations { get; } = [];

        public Task AddAsync(Conversation conversation, CancellationToken cancellationToken = default)
        {
            Conversations.Add(conversation);
            return Task.CompletedTask;
        }

        public Task<Conversation?> GetByHallAndUserAsync(Guid hallId, string userId, CancellationToken cancellationToken = default)
            => Task.FromResult(Conversations.FirstOrDefault(c => c.HallId == hallId && c.SenderUserId == userId));

        public Task<Conversation?> GetByIdWithHallAsync(Guid conversationId, CancellationToken cancellationToken = default)
            => Task.FromResult(Conversations.FirstOrDefault(c => c.Id == conversationId));

        public Task<IReadOnlyList<Conversation>> GetParticipantConversationsAsync(string userId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Conversation>>(Conversations
                .Where(c => c.SenderUserId == userId || c.HallOwnerId == userId)
                .ToList());

        public Task<IReadOnlyList<UserDisplayInfo>> GetUserDisplayNamesAsync(IReadOnlyCollection<string> userIds, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<UserDisplayInfo>>([]);

        public Task UpsertReadStateAsync(Guid conversationId, string userId, DateTimeOffset lastReadAt, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task HideConversationAsync(Guid conversationId, string userId, DateTimeOffset hiddenAt, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<int> GetUnreadConversationCountAsync(string userId, CancellationToken cancellationToken = default) => Task.FromResult(0);
        public Task<Dictionary<Guid, bool>> GetUnreadStatusAsync(string userId, IReadOnlyCollection<Guid> conversationIds, CancellationToken cancellationToken = default) => Task.FromResult<Dictionary<Guid, bool>>(new Dictionary<Guid, bool>());
    }

    private sealed class FakeMessageRepository : IMessageRepository
    {
        private readonly List<Message> _committed = [];
        private readonly List<Message> _pending = [];

        public List<Message> Messages => _committed;

        public Task AddAsync(Message message, CancellationToken cancellationToken = default)
        {
            _pending.Add(message);
            return Task.CompletedTask;
        }

        public void CommitPending()
        {
            _committed.AddRange(_pending);
            _pending.Clear();
        }

        public void RollbackPending()
        {
            _pending.Clear();
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            CommitPending();
            return Task.CompletedTask;
        }

        public Task<Message?> GetByIdAsync(Guid messageId, CancellationToken cancellationToken = default)
            => Task.FromResult<Message?>(null);

        public Task<Message?> GetByClientRequestIdAsync(string senderUserId, string clientRequestId, CancellationToken cancellationToken = default)
            => Task.FromResult(_committed.FirstOrDefault(m => m.SenderUserId == senderUserId && m.ClientRequestId == clientRequestId));

        public Task<IReadOnlyList<Message>> GetByConversationAsync(Guid conversationId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Message>>(_committed
                .Where(m => m.ConversationId == conversationId)
                .ToList());

        public Task<IReadOnlyList<Message>> GetByConversationIdsAsync(IReadOnlyCollection<Guid> conversationIds, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Message>>(_committed
                .Where(m => conversationIds.Contains(m.ConversationId))
                .ToList());
    }

    private sealed class FakeUnitOfWork : IUnitOfWork
    {
        private readonly List<Booking> _bookings;
        private readonly Action _onCommit;
        private readonly Action _onRollback;

        public FakeUnitOfWork(IEnumerable<Booking> bookings, Action onCommit, Action onRollback)
        {
            _bookings = [.. bookings];
            _onCommit = onCommit;
            _onRollback = onRollback;
        }

        public bool ThrowOnSave { get; set; }

        public async Task<TResult> ExecuteInTransactionAsync<TResult>(Func<Task<TResult>> operation, CancellationToken cancellationToken = default)
        {
            var snapshot = _bookings
                .Select(b => new BookingStatusSnapshot(b.Id, b.Status))
                .ToList();

            try
            {
                var result = await operation();
                _onCommit();
                return result;
            }
            catch
            {
                Restore(snapshot);
                _onRollback();
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

    private sealed record BookingStatusSnapshot(Guid Id, BookingStatus Status);

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