using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Conversations;

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

    private static Hall CreateApprovedHall(string name, string ownerId)
        => new()
        {
            Id = Guid.NewGuid(),
            Name = name,
            Status = HallStatus.Approved,
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
        return new ConversationService(conversationRepository, hallRepository, currentUser);
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

        public Task<IReadOnlyList<Hall>> SearchApprovedHallsAsync(string? name, HallRegion? region, string? area, DateOnly? date, BookingPeriodType? period, int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(_halls.Skip(skip).Take(take).ToList());

        public Task<int> SearchApprovedHallsCountAsync(string? name, HallRegion? region, string? area, DateOnly? date, BookingPeriodType? period, CancellationToken cancellationToken = default)
            => Task.FromResult(_halls.Count);

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
