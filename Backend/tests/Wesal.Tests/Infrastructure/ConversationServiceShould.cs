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
        Assert.Equal("owner-1", result.HallOwnerId);
        Assert.Equal("user-1", result.SenderUserId);
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
        Assert.Equal("owner-1", result.HallOwnerId);
        Assert.Equal("owner-2", result.SenderUserId);
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
        Assert.Equal("admin-1", result.SenderUserId);
    }

    [Fact]
    public async Task CreateConversation_UsesServerIdentity_NotClientSupplied()
    {
        var hall = CreateApprovedHall("Test Hall", "owner-1");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "authenticated-user", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateConversationAsync(hall.Id);

        Assert.Equal("authenticated-user", result.SenderUserId);
    }

    [Fact]
    public async Task CreateConversation_ResolvesHallOwner_FromHallRecord()
    {
        var hall = CreateApprovedHall("Test Hall", "actual-owner-id");
        var repository = new FakeConversationRepository();
        var hallRepository = new FakeHallRepository(hall);
        var service = CreateService(repository, hallRepository, authenticated: true, userId: "user-1", roles: [ApplicationRoles.RegisteredUser]);

        var result = await service.CreateConversationAsync(hall.Id);

        Assert.Equal("actual-owner-id", result.HallOwnerId);
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
