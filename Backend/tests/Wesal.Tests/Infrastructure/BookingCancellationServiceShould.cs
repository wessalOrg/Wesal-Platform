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
        Assert.Equal(BookingPeriodType.FirstPeriod, result.Period);
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
        Assert.Equal(BookingPeriodType.FirstPeriod, scenario.Booking.Period);
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
    public async Task CancelBooking_AcceptedBooking_ThrowsConflict()
    {
        var scenario = Scenario();
        scenario.Booking.Status = BookingStatus.Accepted;

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
        Assert.Contains("FirstPeriod", message.Content);
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

        var released = Assert.Single(scenario.BookingRepository.ReleasedPeriods);
        Assert.Equal(scenario.Hall.Id, released.HallId);
        Assert.Equal(scenario.Booking.Date, released.Date);
        Assert.Equal(scenario.Booking.Period, released.Period);
    }

    [Fact]
    public async Task CancelBooking_DoesNotReleasePeriod_WhenAnotherActiveBookingHoldsIt()
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
            Period = booking.Period,
            Status = BookingStatus.Pending
        };
        var scenario = Scenario([booking, other]);

        await scenario.Service.CancelBookingAsync(scenario.Hall.Id, booking.Id);

        Assert.Equal(BookingStatus.Cancelled, booking.Status);
        Assert.Equal(BookingStatus.Pending, other.Status);
        Assert.Empty(scenario.BookingRepository.ReleasedPeriods);
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
            Period = BookingPeriodType.SecondPeriod,
            Status = BookingStatus.Pending
        };
        var scenario = Scenario([booking, other]);

        await scenario.Service.CancelBookingAsync(scenario.Hall.Id, booking.Id);

        var released = Assert.Single(scenario.BookingRepository.ReleasedPeriods);
        Assert.Equal(BookingPeriodType.FirstPeriod, released.Period);
        Assert.Equal(BookingStatus.Pending, other.Status);
    }

    [Fact]
    public async Task CancelBooking_RejectedBookingsDoNotHoldThePeriod()
    {
        var scenario = Scenario();
        scenario.BookingRepository.AddAnother(CreateBooking(scenario.Hall, "user-2", BookingStatus.Rejected));

        await scenario.Service.CancelBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        Assert.Single(scenario.BookingRepository.ReleasedPeriods);
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
        Assert.Empty(scenario.BookingRepository.ReleasedPeriods);
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
            Period = BookingPeriodType.FirstPeriod,
            Status = status
        };

    private sealed class ScenarioContext
    {
        public required FakeBookingRepository BookingRepository { get; init; }

        public required FakeConversationRepository ConversationRepository { get; init; }

        public required FakeMessageRepository MessageRepository { get; init; }

        public required FakeUnitOfWork UnitOfWork { get; set; }

        public required FakeCurrentUserService CurrentUser { get; init; }

        public required BookingCancellationService Service { get; set; }

        public IReadOnlyList<Booking> Bookings => BookingRepository.Bookings;

        public Booking Booking => BookingRepository.Bookings[0];

        public Hall Hall => Booking.Hall;

        public List<Conversation> Conversations => ConversationRepository.Conversations;

        public List<Message> Messages => MessageRepository.Messages;
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

        public List<(Guid HallId, DateOnly Date, BookingPeriodType Period)> ReleasedPeriods { get; } = [];

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

            if (booking is null
                || !string.Equals(booking.RequesterUserId, requesterUserId, StringComparison.Ordinal)
                || booking.Status != BookingStatus.Pending
                || ForceZeroConditionalUpdate)
            {
                return Task.FromResult(0);
            }

            booking.Status = BookingStatus.Cancelled;
            return Task.FromResult(1);
        }

        public Task<bool> HasOtherActiveBookingsAsync(
            Guid hallId,
            DateOnly date,
            BookingPeriodType periodType,
            Guid bookingId,
            CancellationToken cancellationToken = default)
        {
            var hasOther = _bookings.Any(b =>
                b.HallId == hallId
                && b.Date == date
                && b.Period == periodType
                && b.Id != bookingId
                && (b.Status == BookingStatus.Pending || b.Status == BookingStatus.Accepted));

            return Task.FromResult(hasOther);
        }

        public Task<int> ReleasePeriodAsync(
            Guid hallId,
            DateOnly date,
            BookingPeriodType periodType,
            CancellationToken cancellationToken = default)
        {
            ReleasedPeriods.Add((hallId, date, periodType));
            return Task.FromResult(1);
        }

        public Task<int> ReservePeriodAsync(
            Guid hallId,
            DateOnly date,
            BookingPeriodType periodType,
            CancellationToken cancellationToken = default)
            => Task.FromResult(1);
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

        public Task<IWesalTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default)
        {
            var snapshot = _bookings
                .Select(b => new BookingStatusSnapshot(b.Id, b.Status))
                .ToList();

            return Task.FromResult<IWesalTransaction>(new FakeTransaction(snapshot, _bookings, _onCommit, _onRollback));
        }

        public IGenericRepository<TEntity> Repository<TEntity>()
            where TEntity : BaseEntity
            => throw new NotImplementedException();

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            if (ThrowOnSave)
            {
                throw new InvalidOperationException("The save failed.");
            }

            return Task.FromResult(1);
        }
    }

    private sealed class FakeTransaction : IWesalTransaction
    {
        private readonly IReadOnlyList<BookingStatusSnapshot> _snapshot;
        private readonly List<Booking> _bookings;
        private readonly Action _onCommit;
        private readonly Action _onRollback;
        private bool _completed;

        public FakeTransaction(
            IReadOnlyList<BookingStatusSnapshot> snapshot,
            List<Booking> bookings,
            Action onCommit,
            Action onRollback)
        {
            _snapshot = snapshot;
            _bookings = bookings;
            _onCommit = onCommit;
            _onRollback = onRollback;
        }

        public Task CommitAsync(CancellationToken cancellationToken = default)
        {
            _onCommit();
            _completed = true;
            return Task.CompletedTask;
        }

        public Task RollbackAsync(CancellationToken cancellationToken = default)
        {
            Restore();
            _onRollback();
            return Task.CompletedTask;
        }

        public ValueTask DisposeAsync()
        {
            if (!_completed)
            {
                Restore();
                _onRollback();
            }

            return ValueTask.CompletedTask;
        }

        private void Restore()
        {
            foreach (var snapshot in _snapshot)
            {
                var booking = _bookings.FirstOrDefault(b => b.Id == snapshot.Id);

                if (booking is not null)
                {
                    booking.Status = snapshot.Status;
                }
            }
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