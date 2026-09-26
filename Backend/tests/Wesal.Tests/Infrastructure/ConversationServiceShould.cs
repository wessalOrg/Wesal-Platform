using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Conversations;

using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

public class ConversationServiceShould
{
    [Fact]
    public async Task CreateConversation_RegisteredUser_ReturnsConversationResponse()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateConversationAsync(hall.Id);

        Assert.Equal(hall.Id, result.HallId);
        Assert.Equal("owner-1", result.OwnerUserId);
        Assert.Equal("user-1", result.InitiatorUserId);
        Assert.Equal("Test Hall", result.HallName);
        Assert.False(result.IsExisting);
        Assert.NotEqual(Guid.Empty, result.ConversationId);
    }

    [Fact]
    public async Task CreateConversation_StoresConversationInRepository()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await service.CreateConversationAsync(hall.Id);

        Assert.Single(repository.Conversations);
        Assert.Equal(hall.Id, repository.Conversations[0].HallId);
        Assert.Equal("user-1", repository.Conversations[0].SenderUserId);
        Assert.Equal("owner-1", repository.Conversations[0].HallOwnerId);
    }

    [Fact]
    public async Task CreateConversation_HallOwner_CanContactOtherHall()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "owner-2", roles: [ApplicationRoles.HallOwner]);

        var result = await service.CreateConversationAsync(hall.Id);

        Assert.Equal(hall.Id, result.HallId);
        Assert.Equal("owner-1", result.OwnerUserId);
        Assert.Equal("owner-2", result.InitiatorUserId);
    }

    [Fact]
    public async Task CreateConversation_Guest_ThrowsUnauthorized()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: false);

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.CreateConversationAsync(hall.Id));
    }

    [Fact]
    public async Task CreateConversation_HallOwner_SelfContact_ThrowsForbidden()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "owner-1", roles: [ApplicationRoles.HallOwner]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.CreateConversationAsync(hall.Id));
    }

    [Fact]
    public async Task CreateConversation_HallOwner_SelfContact_DoesNotStoreConversation()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "owner-1", roles: [ApplicationRoles.HallOwner]);

        try
        {
            await service.CreateConversationAsync(hall.Id);
        }
        catch (ForbiddenException)
        {
        }

        Assert.Empty(repository.Conversations);
    }

    [Fact]
    public async Task CreateConversation_RegisteredUser_SelfContact_ThrowsForbidden()
    {
        var hall = CreateApprovedHall("Test Hall", "user-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.CreateConversationAsync(hall.Id));
    }

    [Fact]
    public async Task CreateConversation_NonexistentHall_ThrowsNotFound()
    {
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository();
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.CreateConversationAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task CreateConversation_DeletedHall_ThrowsNotFound()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        hall.IsDeleted = true;
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.CreateConversationAsync(hall.Id));
    }

    [Fact]
    public async Task CreateConversation_PendingReviewHall_ThrowsNotFound()
    {
        var hall = new Hall
        {
            Id = Guid.NewGuid(),
            Name = "Test Hall",
            Status = HallStatus.PendingReview,
            OwnerId = "owner-1"
        };
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.CreateConversationAsync(hall.Id));
    }

    [Fact]
    public async Task CreateConversation_RejectedHall_ThrowsNotFound()
    {
        var hall = new Hall
        {
            Id = Guid.NewGuid(),
            Name = "Test Hall",
            Status = HallStatus.Rejected,
            OwnerId = "owner-1"
        };
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.CreateConversationAsync(hall.Id));
    }

    [Fact]
    public async Task CreateConversation_Admin_CanCreateConversation()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "admin-1", roles: [ApplicationRoles.Admin]);

        var result = await service.CreateConversationAsync(hall.Id);

        Assert.Equal(hall.Id, result.HallId);
        Assert.Equal("admin-1", result.InitiatorUserId);
    }

    [Fact]
    public async Task CreateConversation_UsesServerIdentity_NotClientSupplied()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "authenticated-user", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateConversationAsync(hall.Id);

        Assert.Equal("authenticated-user", result.InitiatorUserId);
    }

    [Fact]
    public async Task CreateConversation_ResolvesHallOwner_FromHallRecord()
    {
        var hall = CreateApprovedHall("Test Hall", "actual-owner-id");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateConversationAsync(hall.Id);

        Assert.Equal("actual-owner-id", result.OwnerUserId);
    }

    [Fact]
    public async Task CreateConversation_InvalidRole_ThrowsForbidden()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: []);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.CreateConversationAsync(hall.Id));
    }

    [Fact]
    public async Task CreateConversation_ExistingConversation_ReturnsExistingWithFlag()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);

        var existing = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            SenderUserId = "user-1",
            HallOwnerId = "owner-1",
            CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-5)
        };
        repository.Conversations.Add(existing);

        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateConversationAsync(hall.Id);

        Assert.True(result.IsExisting);
        Assert.Equal(existing.Id, result.ConversationId);
        Assert.Single(repository.Conversations);
    }

    [Fact]
    public async Task CreateConversation_NoExisting_CreatesNewWithFlagFalse()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateConversationAsync(hall.Id);

        Assert.False(result.IsExisting);
        Assert.Single(repository.Conversations);
    }

    [Fact]
    public async Task CreateConversation_DifferentUser_SameHall_CreatesSeparateConversation()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);

        var existing = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            SenderUserId = "user-1",
            HallOwnerId = "owner-1",
            CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-5)
        };
        repository.Conversations.Add(existing);

        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-2", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateConversationAsync(hall.Id);

        Assert.False(result.IsExisting);
        Assert.Equal(2, repository.Conversations.Count);
    }

    [Fact]
    public async Task CreateConversation_ReturnsHallName()
    {
        var hall = CreateApprovedHall("My Wedding Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateConversationAsync(hall.Id);

        Assert.Equal("My Wedding Hall", result.HallName);
    }

    [Fact]
    public async Task GetConversation_Participant_ReturnsConversation()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var conversationId = Guid.NewGuid();
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        repository.Conversations.Add(new Conversation
        {
            Id = conversationId,
            HallId = hall.Id,
            SenderUserId = "user-1",
            HallOwnerId = "owner-1",
            Hall = hall,
            CreatedAt = DateTimeOffset.UtcNow
        });

        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.GetConversationAsync(conversationId);

        Assert.Equal(conversationId, result.ConversationId);
        Assert.Equal("Test Hall", result.HallName);
        Assert.True(result.IsExisting);
    }

    [Fact]
    public async Task GetConversation_HallOwner_ReturnsConversation()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var conversationId = Guid.NewGuid();
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        repository.Conversations.Add(new Conversation
        {
            Id = conversationId,
            HallId = hall.Id,
            SenderUserId = "user-1",
            HallOwnerId = "owner-1",
            Hall = hall,
            CreatedAt = DateTimeOffset.UtcNow
        });

        var service = CreateService(repository, hallRepository, authenticated: true, userId: "owner-1", roles: [ApplicationRoles.HallOwner]);

        var result = await service.GetConversationAsync(conversationId);

        Assert.Equal(conversationId, result.ConversationId);
    }

    [Fact]
    public async Task GetConversation_Admin_ReturnsConversation()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var conversationId = Guid.NewGuid();
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        repository.Conversations.Add(new Conversation
        {
            Id = conversationId,
            HallId = hall.Id,
            SenderUserId = "user-1",
            HallOwnerId = "owner-1",
            Hall = hall,
            CreatedAt = DateTimeOffset.UtcNow
        });

        var service = CreateService(repository, hallRepository, authenticated: true, userId: "admin-1", roles: [ApplicationRoles.Admin]);

        var result = await service.GetConversationAsync(conversationId);

        Assert.Equal(conversationId, result.ConversationId);
    }

    [Fact]
    public async Task GetConversation_NonParticipant_ThrowsForbidden()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var conversationId = Guid.NewGuid();
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        repository.Conversations.Add(new Conversation
        {
            Id = conversationId,
            HallId = hall.Id,
            SenderUserId = "user-1",
            HallOwnerId = "owner-1",
            Hall = hall,
            CreatedAt = DateTimeOffset.UtcNow
        });

        var service = CreateService(repository, hallRepository, authenticated: true, userId: "stranger-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.GetConversationAsync(conversationId));
    }

    [Fact]
    public async Task GetConversation_NonexistentId_ThrowsNotFound()
    {
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository();
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.GetConversationAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task GetConversation_Unauthenticated_ThrowsUnauthorized()
    {
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository();
        var service = CreateService(repository, hallRepository, authenticated: false);

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.GetConversationAsync(Guid.NewGuid()));
    }

    // --- WESAL-TASK-6, Edit 6: single seeker/owner thread + per-user soft delete ---

    [Fact]
    public async Task CreateConversation_SeekerContactingTheSameOwnerTwice_ReusesTheSameThread()
    {
        // A seeker who taps "Contact Owner" repeatedly must land in one thread, not a new one
        // each time. This is the guarantee the owner relies on when replying to a question.
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        var first = await service.CreateConversationAsync(hall.Id);
        var second = await service.CreateConversationAsync(hall.Id);

        Assert.False(first.IsExisting);
        Assert.True(second.IsExisting);
        Assert.Equal(first.ConversationId, second.ConversationId);
        Assert.Single(repository.Conversations);
    }

    [Fact]
    public async Task CreateConversation_SeekerContactingTheSameOwnerAboutAnotherHall_OpensASeparateThread()
    {
        // Threading is per seeker + owner + hall. The same owner owns two halls, and the seeker's
        // question about one of them must not be mixed into the other.
        var firstHall = CreateApprovedHall("First Hall", "owner-1");
        var secondHall = CreateApprovedHall("Second Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(firstHall, secondHall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        var first = await service.CreateConversationAsync(firstHall.Id);
        var second = await service.CreateConversationAsync(secondHall.Id);

        Assert.NotEqual(first.ConversationId, second.ConversationId);
        Assert.Equal(2, repository.Conversations.Count);
    }

    [Fact]
    public async Task HideConversation_Participant_HidesTheThreadForThemselfOnly()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var seeker = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);
        var created = await seeker.CreateConversationAsync(hall.Id);

        await seeker.HideConversationAsync(created.ConversationId);

        var hidden = Assert.Single(repository.HiddenConversations);
        Assert.Equal(created.ConversationId, hidden.ConversationId);
        Assert.Equal("user-1", hidden.UserId);
    }

    [Fact]
    public async Task HideConversation_HallOwner_CanHideTheThreadToo()
    {
        // Hiding is symmetric: the owner is equally entitled to clear a thread from their inbox.
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var seeker = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);
        var created = await seeker.CreateConversationAsync(hall.Id);
        var owner = CreateService(repository, hallRepository, authenticated: true, userId: "owner-1", roles: [ApplicationRoles.HallOwner]);

        await owner.HideConversationAsync(created.ConversationId);

        Assert.Equal("owner-1", Assert.Single(repository.HiddenConversations).UserId);
    }

    [Fact]
    public async Task HideConversation_NonParticipant_IsForbidden()
    {
        // A third party must never be able to remove somebody else's thread, not even by id.
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var seeker = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);
        var created = await seeker.CreateConversationAsync(hall.Id);
        var stranger = CreateService(repository, hallRepository, authenticated: true, userId: "user-2", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<ForbiddenException>(() => stranger.HideConversationAsync(created.ConversationId));

        Assert.Empty(repository.HiddenConversations);
    }

    [Fact]
    public async Task HideConversation_Unauthenticated_ThrowsUnauthorized()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var anonymous = CreateService(repository, hallRepository, authenticated: false);

        await Assert.ThrowsAsync<UnauthorizedException>(
            () => anonymous.HideConversationAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task HideConversation_UnknownConversation_ThrowsNotFound()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var service = CreateService(repository, new FakeHallRepository(hall), authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<NotFoundException>(() => service.HideConversationAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task HideConversation_ConversationWhoseHallWasDeleted_ThrowsNotFound()
    {
        // A soft-deleted hall must not remain reachable through its threads.
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var seeker = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);
        var created = await seeker.CreateConversationAsync(hall.Id);
        // The real repository loads the hall alongside the thread; the fake only fills the
        // navigation when a test needs the deleted-hall rule exercised.
        repository.Conversations[0].Hall = hall;
        hall.IsDeleted = true;
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<NotFoundException>(() => service.HideConversationAsync(created.ConversationId));
    }

    private static Hall CreateApprovedHall(string name, string ownerId)
        => new()
        {
            Id = Guid.NewGuid(),
            Name = name,
            Status = HallStatus.Approved,
            PaymentStatus = HallPaymentStatus.Paid,
            OwnerId = ownerId
        };

    private static ConversationService CreateService(
        FakeConversationRepository conversationRepository,
        FakeHallRepository hallRepository,
        bool authenticated,
        string? userId = null,
        IReadOnlyList<string>? roles = null)
    {
        var effectiveUserId = authenticated && userId is null ? "test-user-1" : userId;
        var currentUser = new FakeCurrentUserService(effectiveUserId, authenticated, roles ?? []);
        return new ConversationService(conversationRepository, new FakeMessageRepository(), new FakeBookingRejectionService(), new NoOpBookingAcceptanceService(), hallRepository, currentUser, new FakeConversationNotifier(), new FakeDocumentStorage());
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
        {
            return Task.FromResult(Conversations.FirstOrDefault(c => c.HallId == hallId && c.SenderUserId == userId));
        }

        public Task<Conversation?> GetByIdWithHallAsync(Guid conversationId, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(Conversations.FirstOrDefault(c => c.Id == conversationId));
        }

        public Task<IReadOnlyList<Conversation>> GetParticipantConversationsAsync(string userId, CancellationToken cancellationToken = default)
        {
            var conversations = Conversations
                .Where(c => (c.SenderUserId == userId || c.HallOwnerId == userId) && c.Hall?.IsDeleted != true)
                .OrderByDescending(c => c.CreatedAt)
                .ThenByDescending(c => c.Id)
                .ToList();
            return Task.FromResult<IReadOnlyList<Conversation>>(conversations);
        }

        public Task<IReadOnlyList<UserDisplayInfo>> GetUserDisplayNamesAsync(IReadOnlyCollection<string> userIds, CancellationToken cancellationToken = default)
        {
            var displayInfos = userIds
                .Select(id => new UserDisplayInfo { UserId = id, FullName = $"Display of {id}" })
                .ToList();
            return Task.FromResult<IReadOnlyList<UserDisplayInfo>>(displayInfos);
        }

        public Task UpsertReadStateAsync(Guid conversationId, string userId, DateTimeOffset lastReadAt, CancellationToken cancellationToken = default) => Task.CompletedTask;

        public List<(Guid ConversationId, string UserId, DateTimeOffset HiddenAt)> HiddenConversations { get; } = [];

        public Task HideConversationAsync(Guid conversationId, string userId, DateTimeOffset hiddenAt, CancellationToken cancellationToken = default)
        {
            HiddenConversations.Add((conversationId, userId, hiddenAt));
            return Task.CompletedTask;
        }

        public Task<int> GetUnreadConversationCountAsync(string userId, CancellationToken cancellationToken = default) => Task.FromResult(0);
        public Task<Dictionary<Guid, bool>> GetUnreadStatusAsync(string userId, IReadOnlyCollection<Guid> conversationIds, CancellationToken cancellationToken = default) => Task.FromResult<Dictionary<Guid, bool>>(new Dictionary<Guid, bool>());
    }

    private sealed class FakeMessageRepository : IMessageRepository
    {
        public Task AddAsync(Message message, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task SaveChangesAsync(CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<Message?> GetByIdAsync(Guid messageId, CancellationToken cancellationToken = default)
            => Task.FromResult<Message?>(null);

        public Task<Message?> GetByClientRequestIdAsync(string senderUserId, string clientRequestId, CancellationToken cancellationToken = default)
            => Task.FromResult<Message?>(null);

        public Task<IReadOnlyList<Message>> GetByConversationAsync(Guid conversationId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Message>>([]);

        public Task<IReadOnlyList<Message>> GetByConversationIdsAsync(IReadOnlyCollection<Guid> conversationIds, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Message>>([]);
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
        private readonly List<Hall> _halls;

        public FakeHallRepository(params Hall[] halls)
        {
            _halls = [.. halls];
        }

        public Task<Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default)
            => Task.FromResult(_halls.FirstOrDefault(h => h.Id == id));

        public Task<IReadOnlyList<Hall>> GetApprovedHallsAsync(int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(_halls.Take(count).ToList());

        public Task<IReadOnlyList<Hall>> GetApprovedHallsByRegionAsync(HallRegion region, int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(_halls.Where(h => h.Region == region).Take(count).ToList());

        public Task<IReadOnlyList<Hall>> GetApprovedHallsPaginatedAsync(int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(_halls.Skip(skip).Take(take).ToList());

        public Task<int> GetApprovedHallsCountAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(_halls.Count);

        public Task<IReadOnlyList<Hall>> SearchApprovedHallsAsync(string? name, HallRegion? region, string? area, string? detailedAddress, DateOnly? date, TimeOnly? startTime, int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(_halls.Skip(skip).Take(take).ToList());

        public Task<int> SearchApprovedHallsCountAsync(string? name, HallRegion? region, string? area, string? detailedAddress, DateOnly? date, TimeOnly? startTime, CancellationToken cancellationToken = default)
            => Task.FromResult(_halls.Count);

        public Task<IReadOnlyList<HallImage>> GetHallImagesAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallImage>>([]);

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

    private sealed class FakeConversationNotifier : IConversationNotifier
    {
        public Task NotifyMessageSentAsync(MessageSentEvent message, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private sealed class FakeDocumentStorage : IDocumentStorage
    {
        public string Root => Path.Combine(Path.GetTempPath(), "wesal-test-documents");

        public string OwnerDocumentsDirectory(string ownerId) => Path.Combine(Root, "documents", "owners", ownerId);

    
        public string ConversationAttachmentsDirectory(Guid conversationId) => Path.Combine(Root, "documents", "conversations", conversationId.ToString(), "attachments");
    }
}
