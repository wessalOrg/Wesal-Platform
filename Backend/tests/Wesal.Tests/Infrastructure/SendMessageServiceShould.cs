using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Conversations;

namespace Wesal.Tests.Infrastructure;

public class SendMessageServiceShould
{
    [Fact]
    public async Task SendMessage_RegisteredUserParticipant_PersistsAndReturnsMessage()
    {
        var service = CreateService(authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.SendMessageAsync(ConversationId, new SendMessageRequest { Content = "Hello" });

        Assert.Equal(ConversationId, result.ConversationId);
        Assert.Equal("user-1", result.SenderUserId);
        Assert.Equal("Hello", result.Content);
        Assert.NotEqual(Guid.Empty, result.MessageId);
        Assert.False(result.IsDuplicate);
        Assert.True(result.SentAt <= DateTimeOffset.UtcNow);
        Assert.Single(service.MessageStore.Snapshot());
    }

    [Fact]
    public async Task SendMessage_HallOwnerParticipant_PersistsAndReturnsMessage()
    {
        var service = CreateService(authenticated: true, userId: "owner-1", roles: [ApplicationRoles.HallOwner]);

        var result = await service.SendMessageAsync(ConversationId, new SendMessageRequest { Content = "Available" });

        Assert.Equal("owner-1", result.SenderUserId);
        Assert.Equal("Available", result.Content);
        Assert.Single(service.MessageStore.Snapshot());
    }

    [Fact]
    public async Task SendMessage_PersistsMessageWithRequiredFields()
    {
        var service = CreateService(authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.SendMessageAsync(ConversationId, new SendMessageRequest { Content = "  Persist me  " });

        var stored = Assert.Single(service.MessageStore.Snapshot());
        Assert.Equal(ConversationId, stored.ConversationId);
        Assert.Equal("user-1", stored.SenderUserId);
        Assert.Equal("Persist me", stored.Content);
        Assert.NotEqual(default, stored.CreatedAt);
        Assert.Equal("Display of user-1", result.SenderName);
        Assert.False(result.IsDuplicate);
    }

    [Fact]
    public async Task SendMessage_EmptyContent_ThrowsValidation()
    {
        var service = CreateService(authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.SendMessageAsync(ConversationId, new SendMessageRequest { Content = "" }));
    }

    [Fact]
    public async Task SendMessage_WhitespaceOnlyContent_ThrowsValidation()
    {
        var service = CreateService(authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.SendMessageAsync(ConversationId, new SendMessageRequest { Content = "   " }));
    }

    [Fact]
    public async Task SendMessage_ContentOverMaxLength_ThrowsValidation()
    {
        var service = CreateService(authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.SendMessageAsync(ConversationId, new SendMessageRequest { Content = new string('a', 1001) }));
    }

    [Fact]
    public async Task SendMessage_NonexistentConversation_ThrowsNotFound()
    {
        var service = CreateService(authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.SendMessageAsync(Guid.NewGuid(), new SendMessageRequest { Content = "Hello" }));
    }

    [Fact]
    public async Task SendMessage_DeletedConversationHall_ThrowsNotFound()
    {
        var service = CreateService(authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser], hallDeleted: true);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.SendMessageAsync(ConversationId, new SendMessageRequest { Content = "Hello" }));
    }

    [Fact]
    public async Task SendMessage_Unauthenticated_ThrowsUnauthorized()
    {
        var service = CreateService(authenticated: false);

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.SendMessageAsync(ConversationId, new SendMessageRequest { Content = "Hello" }));
    }

    [Fact]
    public async Task SendMessage_NonParticipant_ThrowsForbidden()
    {
        var service = CreateService(authenticated: true, userId: "stranger-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.SendMessageAsync(ConversationId, new SendMessageRequest { Content = "Hello" }));
    }

    [Fact]
    public async Task SendMessage_NonParticipant_DoesNotPersist()
    {
        var service = CreateService(authenticated: true, userId: "stranger-1", roles: [ApplicationRoles.RegisteredUser]);

        try
        {
            await service.SendMessageAsync(ConversationId, new SendMessageRequest { Content = "Hello" });
        }
        catch (ForbiddenException)
        {
        }

        Assert.Empty(service.MessageStore.Snapshot());
    }

    [Fact]
    public async Task SendMessage_UsesServerIdentity_NotClientSupplied()
    {
        var service = CreateService(authenticated: true, userId: "authenticated-user", roles: [ApplicationRoles.RegisteredUser], participantUserId: "authenticated-user");

        var result = await service.SendMessageAsync(ConversationId, new SendMessageRequest { Content = "Hello" });

        Assert.Equal("authenticated-user", result.SenderUserId);
        var stored = Assert.Single(service.MessageStore.Snapshot());
        Assert.Equal("authenticated-user", stored.SenderUserId);
    }

    [Fact]
    public async Task SendMessage_ChangesConversationId_SendsIntoThatConversationOnly()
    {
        var service = CreateService(authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.SendMessageAsync(OtherConversationId, new SendMessageRequest { Content = "Hello" }));

        Assert.Empty(service.MessageStore.Snapshot());
    }

    [Fact]
    public async Task SendMessage_DeliversRealTimeUsingNewlyPersistedMessage()
    {
        var service = CreateService(authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await service.SendMessageAsync(ConversationId, new SendMessageRequest { Content = "Hello" });

        var notified = Assert.Single(service.Notifier.Notified);
        var persisted = Assert.Single(service.MessageStore.Snapshot());
        Assert.Equal(persisted.Id, notified.MessageId);
        Assert.Equal(persisted.ConversationId, notified.ConversationId);
        Assert.Equal(persisted.SenderUserId, notified.SenderUserId);
        Assert.Equal(persisted.CreatedAt, notified.SentAt);
        Assert.Equal("Display of user-1", notified.SenderName);
    }

    [Fact]
    public async Task SendMessage_DoesNotNotifyOnUnauthorizedSend()
    {
        var service = CreateService(authenticated: true, userId: "stranger-1", roles: [ApplicationRoles.RegisteredUser]);

        try
        {
            await service.SendMessageAsync(ConversationId, new SendMessageRequest { Content = "Hello" });
        }
        catch (ForbiddenException)
        {
        }

        Assert.Empty(service.Notifier.Notified);
    }

    [Fact]
    public async Task SendMessage_NotifierFailure_DoesNotFailSendOrRejectResponse()
    {
        var service = CreateService(authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser], notifierThrows: true);

        var result = await service.SendMessageAsync(ConversationId, new SendMessageRequest { Content = "Hello" });

        Assert.Equal("Hello", result.Content);
        Assert.Single(service.MessageStore.Snapshot());
    }

    [Fact]
    public async Task SendMessage_RetrySameClientRequestId_ReturnsExistingWithoutDuplicate()
    {
        var service = CreateService(authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);
        var request = new SendMessageRequest { Content = "Hello", ClientRequestId = "req-1" };

        var first = await service.SendMessageAsync(ConversationId, request);
        var second = await service.SendMessageAsync(ConversationId, request);

        Assert.Equal(first.MessageId, second.MessageId);
        Assert.False(first.IsDuplicate);
        Assert.True(second.IsDuplicate);
        Assert.Single(service.MessageStore.Snapshot());
    }

    [Fact]
    public async Task SendMessage_DifferentClientRequestIds_CreateSeparateMessages()
    {
        var service = CreateService(authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await service.SendMessageAsync(ConversationId, new SendMessageRequest { Content = "One", ClientRequestId = "req-1" });
        await service.SendMessageAsync(ConversationId, new SendMessageRequest { Content = "Two", ClientRequestId = "req-2" });

        Assert.Equal(2, service.MessageStore.Snapshot().Count);
    }

    [Fact]
    public async Task SendMessage_ConcurrentDuplicateRequests_PersistOnlyOneMessage()
    {
        var service = CreateService(authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);
        var request = new SendMessageRequest { Content = "Hello", ClientRequestId = "req-race" };

        var results = await Task.WhenAll(
            service.SendMessageAsync(ConversationId, request),
            service.SendMessageAsync(ConversationId, request));

        var ids = results.Select(r => r.MessageId).Distinct().ToArray();
        Assert.Single(ids);
        Assert.Single(service.MessageStore.Snapshot());
    }

    [Fact]
    public async Task SendMessage_NewMessageIntegratesIntoChronologicalThread()
    {
        var service = CreateService(authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser], seedMessages: true);

        await service.SendMessageAsync(ConversationId, new SendMessageRequest { Content = "Latest" });

        var thread = await service.Service.GetConversationThreadAsync(ConversationId);
        var contents = thread.Messages.Select(m => m.Content).ToArray();
        Assert.Equal(["Older", "Latest"], contents);
    }

    [Fact]
    public async Task SendMessage_MissingConversation_DoesNotPersist()
    {
        var service = CreateService(authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        try
        {
            await service.SendMessageAsync(Guid.NewGuid(), new SendMessageRequest { Content = "Hello" });
        }
        catch (NotFoundException)
        {
        }

        Assert.Empty(service.MessageStore.Snapshot());
    }

    private static readonly Guid ConversationId = Guid.NewGuid();
    private static readonly Guid OtherConversationId = Guid.NewGuid();
    private static readonly Guid HallId = Guid.NewGuid();

    private static TestHarness CreateService(
        bool authenticated,
        string? userId = null,
        IReadOnlyList<string>? roles = null,
        bool hallDeleted = false,
        bool seedMessages = false,
        bool notifierThrows = false,
        string participantUserId = "user-1")
    {
        var effectiveUserId = authenticated ? userId ?? "user-1" : null;
        var currentUser = new FakeCurrentUserService(effectiveUserId, authenticated, roles ?? []);
        var conversationRepository = new FakeConversationRepository(ConversationId, OtherConversationId, HallId, hallDeleted, participantUserId);
        var messageRepository = new FakeMessageRepository();
        var notifier = new FakeConversationNotifier(notifierThrows);
        var service = new ConversationService(
            conversationRepository,
            messageRepository,
            new FakeBookingRejectionService(),
            new FakeHallRepository(ConversationId, HallId),
            currentUser,
            notifier);

        if (seedMessages)
        {
            messageRepository.Seed(ConversationId, "Older", DateTimeOffset.UtcNow.AddMinutes(-10));
        }

        return new TestHarness(service, messageRepository, notifier);
    }

    private sealed record TestHarness(
        ConversationService Service,
        FakeMessageRepository MessageStore,
        FakeConversationNotifier Notifier)
    {
        public Task<SendMessageResponse> SendMessageAsync(
            Guid conversationId,
            SendMessageRequest request,
            CancellationToken cancellationToken = default)
            => Service.SendMessageAsync(conversationId, request, cancellationToken);
    }

    private sealed class FakeConversationRepository : IConversationRepository
    {
        private readonly Guid _conversationId;
        private readonly Guid _otherConversationId;
        private readonly Guid _hallId;
        private readonly bool _hallDeleted;
        private readonly string _participantUserId;

        public FakeConversationRepository(Guid conversationId, Guid otherConversationId, Guid hallId, bool hallDeleted, string participantUserId = "user-1")
        {
            _conversationId = conversationId;
            _otherConversationId = otherConversationId;
            _hallId = hallId;
            _hallDeleted = hallDeleted;
            _participantUserId = participantUserId;
        }

        public Task AddAsync(Conversation conversation, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<Conversation?> GetByHallAndUserAsync(Guid hallId, string userId, CancellationToken cancellationToken = default)
            => Task.FromResult<Conversation?>(null);

        public Task<Conversation?> GetByIdWithHallAsync(Guid conversationId, CancellationToken cancellationToken = default)
        {
            if (conversationId == _conversationId)
            {
                return Task.FromResult<Conversation?>(new Conversation
                {
                    Id = _conversationId,
                    HallId = _hallId,
                    SenderUserId = _participantUserId,
                    HallOwnerId = "owner-1",
                    Hall = new Hall { Id = _hallId, IsDeleted = _hallDeleted }
                });
            }

            if (conversationId == _otherConversationId)
            {
                return Task.FromResult<Conversation?>(new Conversation
                {
                    Id = _otherConversationId,
                    HallId = Guid.NewGuid(),
                    SenderUserId = "other-user",
                    HallOwnerId = "other-owner",
                    Hall = new Hall { Id = Guid.NewGuid(), IsDeleted = false }
                });
            }

            return Task.FromResult<Conversation?>(null);
        }

        public Task<IReadOnlyList<Conversation>> GetParticipantConversationsAsync(string userId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Conversation>>([]);

        public Task<IReadOnlyList<UserDisplayInfo>> GetUserDisplayNamesAsync(IReadOnlyCollection<string> userIds, CancellationToken cancellationToken = default)
        {
            var result = userIds.Select(id => new UserDisplayInfo { UserId = id, FullName = $"Display of {id}" }).ToList();
            return Task.FromResult<IReadOnlyList<UserDisplayInfo>>(result);
        }
    }

    private sealed class FakeMessageRepository : IMessageRepository
    {
        private readonly object _lock = new();
        private readonly List<Message> _pending = [];
        public List<Message> Committed { get; } = [];

        public void Seed(Guid conversationId, string content, DateTimeOffset createdAt)
        {
            lock (_lock)
            {
                Committed.Add(new Message
                {
                    Id = Guid.NewGuid(),
                    ConversationId = conversationId,
                    SenderUserId = "user-1",
                    Content = content,
                    CreatedAt = createdAt
                });
            }
        }

        public Task AddAsync(Message message, CancellationToken cancellationToken = default)
        {
            lock (_lock)
            {
                _pending.Add(message);
            }

            return Task.CompletedTask;
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            lock (_lock)
            {
                foreach (var message in _pending)
                {
                    var conflicts = Committed.Any(existing =>
                        existing.SenderUserId == message.SenderUserId
                        && message.ClientRequestId is not null
                        && existing.ClientRequestId == message.ClientRequestId);

                    if (conflicts)
                    {
                        throw new InvalidOperationException("23505 duplicate key");
                    }

                    Committed.Add(message);
                }

                _pending.Clear();
            }

            return Task.CompletedTask;
        }

        public Task<Message?> GetByClientRequestIdAsync(string senderUserId, string clientRequestId, CancellationToken cancellationToken = default)
        {
            Message? match;
            lock (_lock)
            {
                match = Committed.FirstOrDefault(m => m.SenderUserId == senderUserId && m.ClientRequestId == clientRequestId);
            }

            return Task.FromResult(match);
        }

        public Task<IReadOnlyList<Message>> GetByConversationAsync(Guid conversationId, CancellationToken cancellationToken = default)
        {
            IReadOnlyList<Message> messages;
            lock (_lock)
            {
                messages = Committed
                    .Where(m => m.ConversationId == conversationId)
                    .OrderBy(m => m.CreatedAt)
                    .ThenBy(m => m.Id)
                    .ToList();
            }

            return Task.FromResult(messages);
        }

        public Task<IReadOnlyList<Message>> GetByConversationIdsAsync(IReadOnlyCollection<Guid> conversationIds, CancellationToken cancellationToken = default)
        {
            IReadOnlyList<Message> messages;
            lock (_lock)
            {
                messages = Committed
                    .Where(m => conversationIds.Contains(m.ConversationId))
                    .OrderBy(m => m.CreatedAt)
                    .ThenBy(m => m.Id)
                    .ToList();
            }

            return Task.FromResult(messages);
        }

        public List<Message> Snapshot()
        {
            lock (_lock)
            {
                return new List<Message>(Committed);
            }
        }
    }

    private sealed class FakeConversationNotifier : IConversationNotifier
    {
        private readonly bool _throw;

        public FakeConversationNotifier(bool @throw)
        {
            _throw = @throw;
        }

        public List<MessageSentEvent> Notified { get; } = [];

        public Task NotifyMessageSentAsync(MessageSentEvent message, CancellationToken cancellationToken = default)
        {
            if (_throw)
            {
                throw new InvalidOperationException("delivery failed");
            }

            Notified.Add(message);
            return Task.CompletedTask;
        }
    }

    private sealed class FakeBookingRejectionService : IBookingRejectionService
    {
        public Task<RejectBookingResultDto> RejectBookingAsync(Guid hallId, Guid bookingId, RejectBookingRequestDto request, CancellationToken cancellationToken = default)
            => Task.FromResult(new RejectBookingResultDto());

        public Task<int> DeliverPendingRejectionNotificationsAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(0);
    }

    private sealed class FakeHallRepository : IHallRepository
    {
        private readonly Guid _conversationHallId;
        private readonly Guid _hallId;

        public FakeHallRepository(Guid conversationHallId, Guid hallId)
        {
            _conversationHallId = conversationHallId;
            _hallId = hallId;
        }

        public Task<Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default)
            => Task.FromResult(_hallId == id ? new Hall { Id = id } : null);

        public Task<IReadOnlyList<Hall>> GetApprovedHallsAsync(int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>([]);

        public Task<IReadOnlyList<Hall>> GetApprovedHallsByRegionAsync(HallRegion region, int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>([]);

        public Task<IReadOnlyList<Hall>> GetApprovedHallsPaginatedAsync(int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>([]);

        public Task<int> GetApprovedHallsCountAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(0);

        public Task<IReadOnlyList<Hall>> SearchApprovedHallsAsync(string? name, HallRegion? region, string? area, DateOnly? date, BookingPeriodType? period, int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>([]);

        public Task<int> SearchApprovedHallsCountAsync(string? name, HallRegion? region, string? area, DateOnly? date, BookingPeriodType? period, CancellationToken cancellationToken = default)
            => Task.FromResult(0);

        public Task<IReadOnlyList<HallImage>> GetHallImagesAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallImage>>([]);

        public Task<IReadOnlyList<HallBookingPeriod>> GetBookingPeriodsAsync(IReadOnlyCollection<Guid> hallIds, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallBookingPeriod>>([]);

        public Task<IReadOnlyList<HallAvailability>> GetAvailabilityAsync(IReadOnlyCollection<Guid> hallIds, DateOnly fromDate, DateOnly toDate, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallAvailability>>([]);
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
