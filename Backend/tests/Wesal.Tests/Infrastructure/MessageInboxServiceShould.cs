using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Conversations;

namespace Wesal.Tests.Infrastructure;

public class MessageInboxServiceShould
{
    [Fact]
    public async Task GetMyConversations_RegisteredUser_ReturnsOnlyOwnConversations()
    {
        var userId = "user-1";
        var repository = new FakeConversationRepository();
        var messageRepository = new FakeMessageRepository();
        CreateConversation(repository, hallId: Guid.NewGuid(), sender: userId, owner: "owner-1", hallName: "Hall One");
        CreateConversation(repository, hallId: Guid.NewGuid(), sender: "stranger", owner: "owner-1", hallName: "Hall Two");
        var service = CreateService(repository, messageRepository, authenticated: true, userId, roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.GetMyConversationsAsync();

        var returned = Assert.Single(result);
        Assert.Equal("Hall One", returned.HallName);
    }

    [Fact]
    public async Task GetMyConversations_HallOwner_ReturnsConversations()
    {
        var userId = "owner-1";
        var repository = new FakeConversationRepository();
        var messageRepository = new FakeMessageRepository();
        CreateConversation(repository, hallId: Guid.NewGuid(), sender: "user-1", owner: userId, hallName: "Hall One");
        CreateConversation(repository, hallId: Guid.NewGuid(), sender: "user-2", owner: "other-owner", hallName: "Hall Two");
        var service = CreateService(repository, messageRepository, authenticated: true, userId, roles: [ApplicationRoles.HallOwner]);

        var result = await service.GetMyConversationsAsync();

        var returned = Assert.Single(result);
        Assert.Equal("Hall One", returned.HallName);
    }

    [Fact]
    public async Task GetMyConversations_NoConversations_ReturnsEmptyList()
    {
        var repository = new FakeConversationRepository();
        var messageRepository = new FakeMessageRepository();
        var service = CreateService(repository, messageRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.GetMyConversationsAsync();

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetMyConversations_IncludesLatestMessagePreviewAndTimestamp()
    {
        var userId = "user-1";
        var repository = new FakeConversationRepository();
        var messageRepository = new FakeMessageRepository();
        var conversation = CreateConversation(repository, hallId: Guid.NewGuid(), sender: userId, owner: "owner-1", hallName: "Hall One");
        var recent = new Message
        {
            Id = Guid.NewGuid(),
            ConversationId = conversation.Id,
            SenderUserId = "owner-1",
            Content = "Latest reply",
            CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-1)
        };
        messageRepository.Messages.Add(new Message
        {
            Id = Guid.NewGuid(),
            ConversationId = conversation.Id,
            SenderUserId = userId,
            Content = "Older",
            CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-10)
        });
        messageRepository.Messages.Add(recent);
        var service = CreateService(repository, messageRepository, authenticated: true, userId, roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.GetMyConversationsAsync();

        var returned = Assert.Single(result);
        Assert.Equal("Latest reply", returned.LastMessagePreview);
        Assert.Equal(recent.CreatedAt, returned.LastMessageAt);
        Assert.Equal(2, returned.MessageCount);
    }

    [Fact]
    public async Task GetMyConversations_OrdersByMostRecentActivity()
    {
        var userId = "user-1";
        var repository = new FakeConversationRepository();
        var messageRepository = new FakeMessageRepository();
        var idleConversation = CreateConversation(
            repository,
            hallId: Guid.NewGuid(),
            sender: userId,
            owner: "owner-1",
            hallName: "Idle Hall",
            createdAt: DateTimeOffset.UtcNow.AddHours(-2));
        var activeConversation = CreateConversation(
            repository,
            hallId: Guid.NewGuid(),
            sender: userId,
            owner: "owner-1",
            hallName: "Active Hall",
            createdAt: DateTimeOffset.UtcNow.AddDays(-3));
        messageRepository.Messages.Add(new Message
        {
            Id = Guid.NewGuid(),
            ConversationId = activeConversation.Id,
            SenderUserId = "owner-1",
            Content = "Just messaged",
            CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-5)
        });
        _ = idleConversation;
        var service = CreateService(repository, messageRepository, authenticated: true, userId, roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.GetMyConversationsAsync();

        Assert.Equal(2, result.Count);
        Assert.Equal("Active Hall", result[0].HallName);
        Assert.Equal("Idle Hall", result[1].HallName);
        Assert.Equal("Just messaged", result[0].LastMessagePreview);
        Assert.Equal(string.Empty, result[1].LastMessagePreview);
    }

    [Fact]
    public async Task GetMyConversations_Initiator_ReportsOwnerAsOtherParticipant()
    {
        var userId = "user-1";
        var repository = new FakeConversationRepository();
        var messageRepository = new FakeMessageRepository();
        CreateConversation(repository, hallId: Guid.NewGuid(), sender: userId, owner: "owner-1", hallName: "Hall One");
        var service = CreateService(repository, messageRepository, authenticated: true, userId, roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.GetMyConversationsAsync();

        var returned = Assert.Single(result);
        Assert.Equal("owner-1", returned.OtherParticipantId);
        Assert.Equal("owner-1", returned.OtherParticipantName);
    }

    [Fact]
    public async Task GetMyConversations_Owner_ReportsInitiatorAsOtherParticipant()
    {
        var userId = "owner-1";
        var repository = new FakeConversationRepository();
        var messageRepository = new FakeMessageRepository();
        CreateConversation(repository, hallId: Guid.NewGuid(), sender: "user-1", owner: userId, hallName: "Hall One");
        var service = CreateService(repository, messageRepository, authenticated: true, userId, roles: [ApplicationRoles.HallOwner]);

        var result = await service.GetMyConversationsAsync();

        var returned = Assert.Single(result);
        Assert.Equal("user-1", returned.OtherParticipantId);
    }

    [Fact]
    public async Task GetMyConversations_UsesServerIdentity_NotClientSupplied()
    {
        var repository = new FakeConversationRepository();
        var messageRepository = new FakeMessageRepository();
        CreateConversation(repository, hallId: Guid.NewGuid(), sender: "authenticated-user", owner: "owner-1", hallName: "Hall One");
        var service = CreateService(repository, messageRepository, authenticated: true, userId: "authenticated-user", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.GetMyConversationsAsync();

        var returned = Assert.Single(result);
        Assert.Equal("owner-1", returned.OtherParticipantId);
    }

    [Fact]
    public async Task GetMyConversations_Unauthenticated_ThrowsUnauthorized()
    {
        var repository = new FakeConversationRepository();
        var messageRepository = new FakeMessageRepository();
        var service = CreateService(repository, messageRepository, authenticated: false);

        await Assert.ThrowsAsync<UnauthorizedException>(() => service.GetMyConversationsAsync());
    }

    [Fact]
    public async Task GetMyConversations_RepositoryFailure_Propagates()
    {
        var repository = new ThrowingConversationRepository();
        var messageRepository = new FakeMessageRepository();
        var service = CreateService(repository, messageRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<NotImplementedException>(() => service.GetMyConversationsAsync());
    }

    [Fact]
    public async Task GetConversationThread_Participant_ReturnsChronologicalMessages()
    {
        var userId = "user-1";
        var repository = new FakeConversationRepository();
        var messageRepository = new FakeMessageRepository();
        var conversation = CreateConversation(repository, hallId: Guid.NewGuid(), sender: userId, owner: "owner-1", hallName: "Grand Hall");
        messageRepository.Messages.AddRange(
            CreateMessage(conversation.Id, "owner-1", "First", DateTimeOffset.UtcNow.AddMinutes(-5)),
            CreateMessage(conversation.Id, userId, "Second", DateTimeOffset.UtcNow.AddMinutes(-4)),
            CreateMessage(conversation.Id, "owner-1", "Third", DateTimeOffset.UtcNow));
        var service = CreateService(repository, messageRepository, authenticated: true, userId, roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.GetConversationThreadAsync(conversation.Id);

        Assert.Equal(conversation.Id, result.ConversationId);
        Assert.Equal("Grand Hall", result.HallName);
        Assert.Equal(3, result.Messages.Count);
        Assert.Equal("First", result.Messages[0].Content);
        Assert.Equal("Second", result.Messages[1].Content);
        Assert.Equal("Third", result.Messages[2].Content);
    }

    [Fact]
    public async Task GetConversationThread_HallOwner_ReturnsConversation()
    {
        var userId = "owner-1";
        var repository = new FakeConversationRepository();
        var messageRepository = new FakeMessageRepository();
        var conversation = CreateConversation(repository, hallId: Guid.NewGuid(), sender: "user-1", owner: userId, hallName: "Grand Hall");
        var service = CreateService(repository, messageRepository, authenticated: true, userId, roles: [ApplicationRoles.HallOwner]);

        var result = await service.GetConversationThreadAsync(conversation.Id);

        Assert.Equal(conversation.Id, result.ConversationId);
        Assert.Empty(result.Messages);
    }

    [Fact]
    public async Task GetConversationThread_Admin_ReturnsConversation()
    {
        var repository = new FakeConversationRepository();
        var messageRepository = new FakeMessageRepository();
        var conversation = CreateConversation(repository, hallId: Guid.NewGuid(), sender: "user-1", owner: "owner-1", hallName: "Grand Hall");
        var service = CreateService(repository, messageRepository, authenticated: true, userId: "admin-1", roles: [ApplicationRoles.Admin]);

        var result = await service.GetConversationThreadAsync(conversation.Id);

        Assert.Equal(conversation.Id, result.ConversationId);
    }

    [Fact]
    public async Task GetConversationThread_NonParticipant_ThrowsForbidden()
    {
        var repository = new FakeConversationRepository();
        var messageRepository = new FakeMessageRepository();
        var conversation = CreateConversation(repository, hallId: Guid.NewGuid(), sender: "user-1", owner: "owner-1", hallName: "Grand Hall");
        var service = CreateService(repository, messageRepository, authenticated: true, userId: "stranger-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<ForbiddenException>(() => service.GetConversationThreadAsync(conversation.Id));
    }

    [Fact]
    public async Task GetConversationThread_NonexistentId_ThrowsNotFound()
    {
        var repository = new FakeConversationRepository();
        var messageRepository = new FakeMessageRepository();
        var service = CreateService(repository, messageRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetConversationThreadAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task GetConversationThread_DeletedHall_ThrowsNotFound()
    {
        var repository = new FakeConversationRepository();
        var messageRepository = new FakeMessageRepository();
        var conversation = CreateConversation(repository, hallId: Guid.NewGuid(), sender: "user-1", owner: "owner-1", hallName: "Gone Hall", hallDeleted: true);
        var service = CreateService(repository, messageRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetConversationThreadAsync(conversation.Id));
    }

    [Fact]
    public async Task GetConversationThread_IncludesSenderNames()
    {
        var userId = "user-1";
        var repository = new FakeConversationRepository();
        var messageRepository = new FakeMessageRepository();
        var conversation = CreateConversation(repository, hallId: Guid.NewGuid(), sender: userId, owner: "owner-1", hallName: "Grand Hall");
        messageRepository.Messages.AddRange(
            CreateMessage(conversation.Id, "owner-1", "Hello", DateTimeOffset.UtcNow.AddMinutes(-5)),
            CreateMessage(conversation.Id, userId, "Hi", DateTimeOffset.UtcNow));
        var service = CreateService(repository, messageRepository, authenticated: true, userId, roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.GetConversationThreadAsync(conversation.Id);

        Assert.Equal("owner-1", result.Messages[0].SenderUserId);
        Assert.Equal("owner-1", result.Messages[0].SenderName);
        Assert.Equal(userId, result.Messages[1].SenderUserId);
        Assert.Equal(userId, result.Messages[1].SenderName);
    }

    [Fact]
    public async Task GetConversationThread_UsesServerIdentity_NotClientSupplied()
    {
        var repository = new FakeConversationRepository();
        var messageRepository = new FakeMessageRepository();
        var conversation = CreateConversation(repository, hallId: Guid.NewGuid(), sender: "authenticated-user", owner: "owner-1", hallName: "Grand Hall");
        var service = CreateService(repository, messageRepository, authenticated: true, userId: "authenticated-user", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.GetConversationThreadAsync(conversation.Id);

        Assert.Equal(conversation.Id, result.ConversationId);
    }

    [Fact]
    public async Task GetConversationThread_Unauthenticated_ThrowsUnauthorized()
    {
        var repository = new FakeConversationRepository();
        var messageRepository = new FakeMessageRepository();
        var service = CreateService(repository, messageRepository, authenticated: false);

        await Assert.ThrowsAsync<UnauthorizedException>(() => service.GetConversationThreadAsync(Guid.NewGuid()));
    }

    private static Conversation CreateConversation(
        FakeConversationRepository repository,
        Guid hallId,
        string sender,
        string owner,
        string hallName,
        DateTimeOffset? createdAt = null,
        bool hallDeleted = false)
    {
        var hall = new Hall { Id = hallId, Name = hallName, IsDeleted = hallDeleted };
        repository.Halls[hallId] = hall;
        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = hallId,
            SenderUserId = sender,
            HallOwnerId = owner,
            CreatedAt = createdAt ?? DateTimeOffset.UtcNow
        };
        repository.Conversations.Add(conversation);
        return conversation;
    }

    private static Message CreateMessage(Guid conversationId, string senderUserId, string content, DateTimeOffset createdAt)
        => new()
        {
            Id = Guid.NewGuid(),
            ConversationId = conversationId,
            SenderUserId = senderUserId,
            Content = content,
            CreatedAt = createdAt
        };

    private static ConversationService CreateService(
        IConversationRepository conversationRepository,
        IMessageRepository messageRepository,
        bool authenticated,
        string? userId = null,
        IReadOnlyList<string>? roles = null)
    {
        var effectiveUserId = authenticated ? userId ?? "test-user-1" : null;
        var currentUser = new FakeCurrentUserService(effectiveUserId, authenticated, roles ?? []);
        return new ConversationService(conversationRepository, messageRepository, new FakeBookingRejectionService(), new FakeHallRepository(), currentUser);
    }

    private sealed class FakeConversationRepository : IConversationRepository
    {
        public List<Conversation> Conversations { get; } = [];

        public Dictionary<Guid, Hall> Halls { get; } = [];

        public Task AddAsync(Conversation conversation, CancellationToken cancellationToken = default)
        {
            Conversations.Add(conversation);
            return Task.CompletedTask;
        }

        public Task<Conversation?> GetByHallAndUserAsync(Guid hallId, string userId, CancellationToken cancellationToken = default)
            => Task.FromResult(Conversations.FirstOrDefault(c => c.HallId == hallId && c.SenderUserId == userId));

        public Task<Conversation?> GetByIdWithHallAsync(Guid conversationId, CancellationToken cancellationToken = default)
        {
            var conversation = Conversations.FirstOrDefault(c => c.Id == conversationId);
            if (conversation is not null && Halls.TryGetValue(conversation.HallId, out var hall))
            {
                conversation.Hall = hall;
            }

            return Task.FromResult(conversation);
        }

        public Task<IReadOnlyList<Conversation>> GetParticipantConversationsAsync(string userId, CancellationToken cancellationToken = default)
        {
            var conversations = Conversations
                .Where(c => (c.SenderUserId == userId || c.HallOwnerId == userId)
                    && Halls.TryGetValue(c.HallId, out var hall) && !hall.IsDeleted)
                .Select(c =>
                {
                    c.Hall = Halls[c.HallId];
                    return c;
                })
                .OrderByDescending(c => c.CreatedAt)
                .ThenByDescending(c => c.Id)
                .ToList();
            return Task.FromResult<IReadOnlyList<Conversation>>(conversations);
        }

        public Task<IReadOnlyList<UserDisplayInfo>> GetUserDisplayNamesAsync(IReadOnlyCollection<string> userIds, CancellationToken cancellationToken = default)
        {
            var result = userIds.Select(id => new UserDisplayInfo { UserId = id, FullName = id }).ToList();
            return Task.FromResult<IReadOnlyList<UserDisplayInfo>>(result);
        }
    }

    private sealed class ThrowingConversationRepository : IConversationRepository
    {
        public Task AddAsync(Conversation conversation, CancellationToken cancellationToken = default)
            => throw new NotImplementedException();

        public Task<Conversation?> GetByHallAndUserAsync(Guid hallId, string userId, CancellationToken cancellationToken = default)
            => throw new NotImplementedException();

        public Task<Conversation?> GetByIdWithHallAsync(Guid conversationId, CancellationToken cancellationToken = default)
            => throw new NotImplementedException();

        public Task<IReadOnlyList<Conversation>> GetParticipantConversationsAsync(string userId, CancellationToken cancellationToken = default)
            => throw new NotImplementedException();

        public Task<IReadOnlyList<UserDisplayInfo>> GetUserDisplayNamesAsync(IReadOnlyCollection<string> userIds, CancellationToken cancellationToken = default)
            => throw new NotImplementedException();
    }

    private sealed class FakeMessageRepository : IMessageRepository
    {
        public List<Message> Messages { get; } = [];

        public Task AddAsync(Message message, CancellationToken cancellationToken = default)
        {
            Messages.Add(message);
            return Task.CompletedTask;
        }

        public Task<IReadOnlyList<Message>> GetByConversationAsync(Guid conversationId, CancellationToken cancellationToken = default)
        {
            var messages = Messages
                .Where(m => m.ConversationId == conversationId)
                .OrderBy(m => m.CreatedAt)
                .ThenBy(m => m.Id)
                .ToList();
            return Task.FromResult<IReadOnlyList<Message>>(messages);
        }

        public Task<IReadOnlyList<Message>> GetByConversationIdsAsync(IReadOnlyCollection<Guid> conversationIds, CancellationToken cancellationToken = default)
        {
            var messages = Messages
                .Where(m => conversationIds.Contains(m.ConversationId))
                .OrderBy(m => m.ConversationId)
                .ThenBy(m => m.CreatedAt)
                .ThenBy(m => m.Id)
                .ToList();
            return Task.FromResult<IReadOnlyList<Message>>(messages);
        }
    }

    private sealed class FakeBookingRejectionService : IBookingRejectionService
    {
        public Task<RejectBookingResultDto> RejectBookingAsync(
            Guid hallId,
            Guid bookingId,
            RejectBookingRequestDto request,
            CancellationToken cancellationToken = default)
            => Task.FromResult(new RejectBookingResultDto());

        public Task<int> DeliverPendingRejectionNotificationsAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(0);
    }

    private sealed class FakeHallRepository : IHallRepository
    {
        private readonly List<Hall> _halls = [];

        public Task<Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default)
            => Task.FromResult(_halls.FirstOrDefault(h => h.Id == id));

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