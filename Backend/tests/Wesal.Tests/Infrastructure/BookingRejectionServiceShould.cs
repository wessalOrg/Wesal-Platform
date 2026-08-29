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

public class BookingRejectionServiceShould
{
    private const string OwnerId = "owner-1";
    private const string RequesterId = "user-1";

    [Fact]
    public async Task RejectBooking_HallOwner_RejectsBookingWithReason()
    {
        var scenario = Scenario();
        var result = await scenario.Service.RejectBookingAsync(
            scenario.Hall.Id,
            scenario.Booking.Id,
            new RejectBookingRequestDto { Reason = "  Not available  " });

        Assert.Equal(scenario.Booking.Id, result.BookingId);
        Assert.Equal(BookingStatus.Rejected, scenario.Booking.Status);
        Assert.Equal("Not available", scenario.Booking.RejectionReason);
        Assert.Equal("Not available", result.RejectionReason);
        Assert.False(result.IsAlreadyRejected);
        Assert.Equal(BookingRejectionNotificationStatus.Delivered, result.NotificationStatus);
    }

    [Fact]
    public async Task RejectBooking_DeliversMessageWithHallDatePeriodAndReason()
    {
        var scenario = Scenario();
        var result = await scenario.Service.RejectBookingAsync(
            scenario.Hall.Id,
            scenario.Booking.Id,
            new RejectBookingRequestDto { Reason = "Booked by another customer" });

        var message = Assert.Single(scenario.Messages);
        Assert.Contains(scenario.Hall.Name, message.Content);
        Assert.Contains("2035-06-01", message.Content);
        Assert.Contains("FirstPeriod", message.Content);
        Assert.Contains("Booked by another customer", message.Content);
        Assert.Equal(BookingRejectionNotificationStatus.Delivered, result.NotificationStatus);
    }

    [Fact]
    public async Task RejectBooking_MessageSenderIsHallOwnerAndConversationLinksRequesterAndHall()
    {
        var scenario = Scenario();
        await scenario.Service.RejectBookingAsync(
            scenario.Hall.Id,
            scenario.Booking.Id,
            new RejectBookingRequestDto { Reason = "Not available" });

        var conversation = Assert.Single(scenario.Conversations);
        Assert.Equal(scenario.Hall.Id, conversation.HallId);
        Assert.Equal(RequesterId, conversation.SenderUserId);
        Assert.Equal(OwnerId, conversation.HallOwnerId);
        Assert.Equal(OwnerId, scenario.Messages[0].SenderUserId);
        Assert.Equal(conversation.Id, scenario.Messages[0].ConversationId);
    }

    [Fact]
    public async Task RejectBooking_ReusesExistingConversation_NoDuplicate()
    {
        var scenario = Scenario();
        scenario.Conversations.Add(new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = scenario.Hall.Id,
            SenderUserId = RequesterId,
            HallOwnerId = OwnerId
        });

        await scenario.Service.RejectBookingAsync(
            scenario.Hall.Id,
            scenario.Booking.Id,
            new RejectBookingRequestDto { Reason = "Not available" });

        Assert.Single(scenario.Conversations);
        Assert.Single(scenario.Messages);
    }

    [Fact]
    public async Task RejectBooking_CreatesConversation_WhenNoneExists()
    {
        var scenario = Scenario();

        await scenario.Service.RejectBookingAsync(
            scenario.Hall.Id,
            scenario.Booking.Id,
            new RejectBookingRequestDto { Reason = "Not available" });

        Assert.Single(scenario.Conversations);
    }

    [Fact]
    public async Task RejectBooking_AssociatesBookingWithDeliveredMessage()
    {
        var scenario = Scenario();
        var result = await scenario.Service.RejectBookingAsync(
            scenario.Hall.Id,
            scenario.Booking.Id,
            new RejectBookingRequestDto { Reason = "Not available" });

        Assert.NotNull(scenario.Booking.RejectionMessageId);
        Assert.Equal(scenario.Messages[0].Id, scenario.Booking.RejectionMessageId);
        Assert.Equal(BookingRejectionNotificationStatus.Delivered, result.NotificationStatus);
    }

    [Fact]
    public async Task RejectBooking_DeliveryFailure_RejectionStillPersistsAndStaysPending()
    {
        var scenario = Scenario();
        scenario.UnitOfWork.ThrowOnEverySecondSave = true;

        var result = await scenario.Service.RejectBookingAsync(
            scenario.Hall.Id,
            scenario.Booking.Id,
            new RejectBookingRequestDto { Reason = "Not available" });

        Assert.Equal(BookingStatus.Rejected, scenario.Booking.Status);
        Assert.Equal("Not available", scenario.Booking.RejectionReason);
        Assert.Null(scenario.Booking.RejectionMessageId);
        Assert.Empty(scenario.Messages);
        Assert.Equal(BookingRejectionNotificationStatus.Deferred, result.NotificationStatus);
    }

    [Fact]
    public async Task RejectBooking_DeferredNotification_DeliveredOnLaterPendingRun()
    {
        var scenario = Scenario();
        scenario.UnitOfWork.ThrowOnEverySecondSave = true;

        var result = await scenario.Service.RejectBookingAsync(
            scenario.Hall.Id,
            scenario.Booking.Id,
            new RejectBookingRequestDto { Reason = "Not available" });

        Assert.Equal(BookingRejectionNotificationStatus.Deferred, result.NotificationStatus);
        Assert.Empty(scenario.Messages);

        scenario.UnitOfWork.ClearFailures();

        var deliveredCount = await scenario.Service.DeliverPendingRejectionNotificationsAsync();

        Assert.Equal(1, deliveredCount);
        Assert.NotNull(scenario.Booking.RejectionMessageId);
        Assert.Single(scenario.Messages);
    }

    [Fact]
    public async Task RejectBooking_AlreadyRejected_ReturnsExistingWithoutDuplicateMessage()
    {
        var scenario = Scenario();
        scenario.Booking.Status = BookingStatus.Rejected;
        scenario.Booking.RejectionReason = "Initially rejected";
        scenario.Booking.RejectionMessageId = Guid.NewGuid();

        var result = await scenario.Service.RejectBookingAsync(
            scenario.Hall.Id,
            scenario.Booking.Id,
            new RejectBookingRequestDto { Reason = "Second rejection" });

        Assert.True(result.IsAlreadyRejected);
        Assert.Equal(BookingStatus.Rejected, scenario.Booking.Status);
        Assert.Equal("Initially rejected", scenario.Booking.RejectionReason);
        Assert.Equal(BookingRejectionNotificationStatus.Delivered, result.NotificationStatus);
        Assert.Empty(scenario.Messages);
    }

    [Fact]
    public async Task RejectBooking_RetriedIdempotent_NoAdditionalMessage()
    {
        var scenario = Scenario();

        await scenario.Service.RejectBookingAsync(
            scenario.Hall.Id,
            scenario.Booking.Id,
            new RejectBookingRequestDto { Reason = "Not available" });

        var second = await scenario.Service.RejectBookingAsync(
            scenario.Hall.Id,
            scenario.Booking.Id,
            new RejectBookingRequestDto { Reason = "Typo" });

        Assert.True(second.IsAlreadyRejected);
        Assert.Single(scenario.Messages);
    }

    [Fact]
    public async Task RejectBooking_NonOwnerHallOwner_ThrowsForbidden()
    {
        var scenario = Scenario(userId: "other-owner");

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            scenario.Service.RejectBookingAsync(
                scenario.Hall.Id,
                scenario.Booking.Id,
                new RejectBookingRequestDto { Reason = "Not available" }));
    }

    [Fact]
    public async Task RejectBooking_RegisteredUser_ThrowsForbidden()
    {
        var scenario = Scenario(userId: RequesterId, roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            scenario.Service.RejectBookingAsync(
                scenario.Hall.Id,
                scenario.Booking.Id,
                new RejectBookingRequestDto { Reason = "Not available" }));
    }

    [Fact]
    public async Task RejectBooking_Unauthenticated_ThrowsUnauthorized()
    {
        var scenario = Scenario(userId: null);

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            scenario.Service.RejectBookingAsync(
                scenario.Hall.Id,
                scenario.Booking.Id,
                new RejectBookingRequestDto { Reason = "Not available" }));
    }

    [Fact]
    public async Task RejectBooking_AdminWithoutOwnership_ThrowsForbidden()
    {
        var scenario = Scenario(userId: "admin-1", roles: [ApplicationRoles.Admin]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            scenario.Service.RejectBookingAsync(
                scenario.Hall.Id,
                scenario.Booking.Id,
                new RejectBookingRequestDto { Reason = "Not available" }));
    }

    [Fact]
    public async Task RejectBooking_UnknownBooking_ThrowsNotFound()
    {
        var scenario = Scenario();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            scenario.Service.RejectBookingAsync(
                scenario.Hall.Id,
                Guid.NewGuid(),
                new RejectBookingRequestDto { Reason = "Not available" }));
    }

    [Fact]
    public async Task RejectBooking_WrongHallId_ThrowsNotFound()
    {
        var scenario = Scenario();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            scenario.Service.RejectBookingAsync(
                Guid.NewGuid(),
                scenario.Booking.Id,
                new RejectBookingRequestDto { Reason = "Not available" }));
    }

    [Fact]
    public async Task RejectBooking_DeletedHall_ThrowsNotFound()
    {
        var scenario = Scenario();
        scenario.Hall.IsDeleted = true;

        await Assert.ThrowsAsync<NotFoundException>(() =>
            scenario.Service.RejectBookingAsync(
                scenario.Hall.Id,
                scenario.Booking.Id,
                new RejectBookingRequestDto { Reason = "Not available" }));
    }

    [Fact]
    public async Task RejectBooking_BlankReason_ThrowsValidation()
    {
        var scenario = Scenario();

        await Assert.ThrowsAsync<ValidationException>(() =>
            scenario.Service.RejectBookingAsync(
                scenario.Hall.Id,
                scenario.Booking.Id,
                new RejectBookingRequestDto { Reason = "   " }));
    }

    [Fact]
    public async Task DeliverPending_DeliversAllPendingNotifications()
    {
        var first = CreateBooking(Hall(), RequesterId);
        var second = CreateBooking(Hall(), "user-2");
        var scenario = Scenario([first, second]);
        scenario.UnitOfWork.ThrowOnEverySecondSave = true;

        await scenario.Service.RejectBookingAsync(first.HallId, first.Id, new RejectBookingRequestDto { Reason = "Busy" });
        await scenario.Service.RejectBookingAsync(second.HallId, second.Id, new RejectBookingRequestDto { Reason = "Closed" });

        Assert.Empty(scenario.Messages);

        scenario.UnitOfWork.ClearFailures();

        var deliveredCount = await scenario.Service.DeliverPendingRejectionNotificationsAsync();

        Assert.Equal(2, deliveredCount);
        Assert.Equal(2, scenario.Messages.Count);
    }

    [Fact]
    public async Task DeliverPending_DeliveryFailure_ContinuesWithOtherNotifications()
    {
        var firstHall = Hall();
        var secondHall = Hall();
        var first = CreateBooking(firstHall, RequesterId);
        var second = CreateBooking(secondHall, "user-2");
        var scenario = Scenario([first, second]);
        scenario.UnitOfWork.ThrowOnEverySecondSave = true;

        await scenario.Service.RejectBookingAsync(firstHall.Id, first.Id, new RejectBookingRequestDto { Reason = "Busy" });
        await scenario.Service.RejectBookingAsync(secondHall.Id, second.Id, new RejectBookingRequestDto { Reason = "Closed" });

        Assert.Empty(scenario.Messages);

        scenario.UnitOfWork.ClearFailures();
        scenario.UnitOfWork.ThrowOnNextSave = true;

        var deliveredCount = await scenario.Service.DeliverPendingRejectionNotificationsAsync();

        Assert.Equal(1, deliveredCount);
        Assert.Single(scenario.Messages);
    }

    [Fact]
    public async Task DeliverPending_AlreadyDelivered_Skipped()
    {
        var scenario = Scenario();
        scenario.UnitOfWork.ThrowOnEverySecondSave = true;
        await scenario.Service.RejectBookingAsync(
            scenario.Hall.Id,
            scenario.Booking.Id,
            new RejectBookingRequestDto { Reason = "Not available" });
        Assert.Empty(scenario.Messages);

        scenario.UnitOfWork.ClearFailures();
        await scenario.Service.DeliverPendingRejectionNotificationsAsync();
        Assert.Single(scenario.Messages);

        var deliveredCount = await scenario.Service.DeliverPendingRejectionNotificationsAsync();

        Assert.Equal(0, deliveredCount);
        Assert.Single(scenario.Messages);
    }

    [Fact]
    public async Task RejectionMessage_VisibleInExistingThreadQuery()
    {
        var scenario = Scenario();

        await scenario.Service.RejectBookingAsync(
            scenario.Hall.Id,
            scenario.Booking.Id,
            new RejectBookingRequestDto { Reason = "Not available" });

        var conversation = Assert.Single(scenario.Conversations);
        var payload = await scenario.MessageRepository.GetByConversationAsync(conversation.Id);

        var rejectionMessage = Assert.Single(payload);
        Assert.Contains("grand hall", rejectionMessage.Content, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("not available", rejectionMessage.Content, StringComparison.OrdinalIgnoreCase);
    }

    private static ScenarioContext Scenario(
        IReadOnlyList<Booking>? bookings = null,
        string? userId = OwnerId,
        IReadOnlyList<string>? roles = null)
    {
        var bookingsList = bookings ?? [CreateBooking(Hall(), RequesterId)];
        var hall = bookingsList[0].Hall;
        var currentUser = CurrentUser(userId, roles ?? [ApplicationRoles.HallOwner]);

        var context = new ScenarioContext
        {
            BookingRepository = new FakeBookingRepository([.. bookingsList]),
            ConversationRepository = new FakeConversationRepository(),
            MessageRepository = new FakeMessageRepository(),
            UnitOfWork = new FakeUnitOfWork(),
            CurrentUser = currentUser,
            Service = null!
        };

        context.UnitOfWork.WireTransactions(context.MessageRepository.CommitPending, context.MessageRepository.RollbackPending);

        context.Service = new BookingRejectionService(
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
            OwnerId = OwnerId
        };

    private static Booking CreateBooking(Hall hall, string requesterId)
        => new()
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            Hall = hall,
            RequesterUserId = requesterId,
            Date = new DateOnly(2035, 6, 1),
            Period = BookingPeriodType.FirstPeriod,
            Status = BookingStatus.Pending
        };

    private sealed class ScenarioContext
    {
        public required FakeBookingRepository BookingRepository { get; init; }

        public required FakeConversationRepository ConversationRepository { get; init; }

        public required FakeMessageRepository MessageRepository { get; init; }

        public required FakeUnitOfWork UnitOfWork { get; init; }

        public required FakeCurrentUserService CurrentUser { get; init; }

        public required BookingRejectionService Service { get; set; }

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

        public Task AddAsync(Booking booking, CancellationToken cancellationToken = default)
        {
            _bookings.Add(booking);
            return Task.CompletedTask;
        }

        public Task<Booking?> GetByIdWithHallAsync(Guid bookingId, CancellationToken cancellationToken = default)
            => Task.FromResult(_bookings.FirstOrDefault(b => b.Id == bookingId));

        public Task<IReadOnlyList<Booking>> GetPendingRejectionNotificationsAsync(CancellationToken cancellationToken = default)
        {
            var pending = _bookings
                .Where(b => b.Status == BookingStatus.Rejected && b.RejectionReason != null && b.RejectionMessageId == null)
                .ToList();
            return Task.FromResult<IReadOnlyList<Booking>>(pending);
        }
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
            => Task.FromResult<IReadOnlyList<Conversation>>(Conversations.Where(c => c.SenderUserId == userId || c.HallOwnerId == userId).ToList());

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

        public Task<IReadOnlyList<Message>> GetByConversationAsync(Guid conversationId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Message>>(_committed.Where(m => m.ConversationId == conversationId).ToList());

        public Task<IReadOnlyList<Message>> GetByConversationIdsAsync(IReadOnlyCollection<Guid> conversationIds, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Message>>(_committed.Where(m => conversationIds.Contains(m.ConversationId)).ToList());
    }

    private sealed class FakeUnitOfWork : IUnitOfWork
    {
        private int _saveCount;
        private Action? _onCommit;
        private Action? _onRollback;

        public bool ThrowOnEverySecondSave { get; set; }

        public bool ThrowOnNextSave { get; set; }

        public void WireTransactions(Action onCommit, Action onRollback)
        {
            _onCommit = onCommit;
            _onRollback = onRollback;
        }

        public void ClearFailures()
        {
            ThrowOnEverySecondSave = false;
            ThrowOnNextSave = false;
        }

        public IGenericRepository<TEntity> Repository<TEntity>()
            where TEntity : BaseEntity
            => throw new NotImplementedException();

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            _saveCount++;

            if (ThrowOnNextSave)
            {
                ThrowOnNextSave = false;
                _onRollback?.Invoke();
                throw new InvalidOperationException("The message delivery failed to commit.");
            }

            if (ThrowOnEverySecondSave && _saveCount % 2 == 0)
            {
                _onRollback?.Invoke();
                throw new InvalidOperationException("The message delivery failed to commit.");
            }

            _onCommit?.Invoke();

            return Task.FromResult(1);
        }
    }

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