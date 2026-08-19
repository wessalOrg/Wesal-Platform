using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Conversations;

namespace Wesal.Tests.Infrastructure;

public class ConversationServiceShould
{
    [Fact]
    public async Task CreateConversationAsync_Guest_ThrowsUnauthorized()
    {
        var service = CreateService(authenticated: false);

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.CreateConversationAsync(new CreateConversationRequest { HallId = Guid.NewGuid() }));
    }

    [Fact]
    public async Task CreateConversationAsync_UnavailableHall_ThrowsNotFound()
    {
        var halls = new FakeHallRepository();
        halls.Halls.Add(new Hall
        {
            Id = Guid.NewGuid(),
            Status = HallStatus.PendingReview,
            Name = "Pending"
        });
        var service = CreateService(
            authenticated: true,
            roles: [ApplicationRoles.RegisteredUser],
            halls: halls);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.CreateConversationAsync(new CreateConversationRequest { HallId = halls.Halls[0].Id }));
    }

    [Fact]
    public async Task CreateConversationAsync_OwnHall_ThrowsForbidden()
    {
        var halls = new FakeHallRepository();
        var hallId = Guid.NewGuid();
        halls.Halls.Add(new Hall
        {
            Id = hallId,
            Status = HallStatus.Approved,
            Name = "Mine",
            OwnerId = "user-1"
        });
        var service = CreateService(
            authenticated: true,
            userId: "user-1",
            roles: [ApplicationRoles.HallOwner],
            halls: halls);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.CreateConversationAsync(new CreateConversationRequest { HallId = hallId }));
    }

    [Fact]
    public async Task CreateConversationAsync_RegisteredUser_CreatesConversation()
    {
        var halls = new FakeHallRepository();
        var conversations = new FakeConversationRepository();
        var hallId = Guid.NewGuid();
        halls.Halls.Add(new Hall
        {
            Id = hallId,
            Status = HallStatus.Approved,
            Name = "قاعة النور",
            OwnerId = "owner-1"
        });
        var service = CreateService(
            authenticated: true,
            userId: "user-1",
            roles: [ApplicationRoles.RegisteredUser],
            halls,
            conversations);

        var result = await service.CreateConversationAsync(new CreateConversationRequest { HallId = hallId });

        Assert.False(result.IsExisting);
        Assert.Equal(hallId, result.HallId);
        Assert.Equal("قاعة النور", result.HallName);
        Assert.Equal("user-1", result.InitiatorUserId);
        Assert.Equal("owner-1", result.OwnerUserId);
        Assert.Single(conversations.Items);
    }

    [Fact]
    public async Task CreateConversationAsync_ExistingConversation_ReturnsSameThread()
    {
        var halls = new FakeHallRepository();
        var conversations = new FakeConversationRepository();
        var hallId = Guid.NewGuid();
        halls.Halls.Add(new Hall
        {
            Id = hallId,
            Status = HallStatus.Approved,
            Name = "قاعة النور",
            OwnerId = "owner-1"
        });
        var existing = new Conversation
        {
            HallId = hallId,
            InitiatorUserId = "user-1",
            OwnerUserId = "owner-1"
        };
        conversations.Items.Add(existing);
        var service = CreateService(
            authenticated: true,
            userId: "user-1",
            roles: [ApplicationRoles.RegisteredUser],
            halls,
            conversations);

        var result = await service.CreateConversationAsync(new CreateConversationRequest { HallId = hallId });

        Assert.True(result.IsExisting);
        Assert.Equal(existing.Id, result.ConversationId);
        Assert.Single(conversations.Items);
    }

    [Fact]
    public async Task CreateConversationAsync_HallOwnerOfOtherHall_IsAllowed()
    {
        var halls = new FakeHallRepository();
        var conversations = new FakeConversationRepository();
        var hallId = Guid.NewGuid();
        halls.Halls.Add(new Hall
        {
            Id = hallId,
            Status = HallStatus.Approved,
            Name = "قاعة أخرى",
            OwnerId = "other-owner"
        });
        var service = CreateService(
            authenticated: true,
            userId: "owner-2",
            roles: [ApplicationRoles.HallOwner],
            halls,
            conversations);

        var result = await service.CreateConversationAsync(new CreateConversationRequest { HallId = hallId });

        Assert.False(result.IsExisting);
        Assert.Equal("owner-2", result.InitiatorUserId);
    }

    private static ConversationService CreateService(
        bool authenticated,
        string userId = "user-1",
        string? userName = "user",
        IReadOnlyList<string>? roles = null,
        FakeHallRepository? halls = null,
        FakeConversationRepository? conversations = null)
    {
        halls ??= new FakeHallRepository();
        conversations ??= new FakeConversationRepository();
        var currentUser = new FakeCurrentUser(authenticated, userId, userName, roles ?? []);
        return new ConversationService(conversations, halls, currentUser);
    }

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        public FakeCurrentUser(bool authenticated, string userId, string? userName, IReadOnlyList<string> roles)
        {
            IsAuthenticated = authenticated;
            UserId = authenticated ? userId : null;
            UserName = authenticated ? userName : null;
            Roles = roles;
        }

        public string? UserId { get; }
        public string? UserName { get; }
        public string? Email => null;
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles { get; }
    }

    private sealed class FakeHallRepository : IHallRepository
    {
        public List<Hall> Halls { get; } = [];

        public Task<Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default)
            => Task.FromResult(Halls.FirstOrDefault(hall => hall.Id == id));

        public Task<IReadOnlyList<Hall>> GetApprovedHallsAsync(int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>([]);

        public Task<IReadOnlyList<Hall>> GetApprovedHallsByRegionAsync(
            HallRegion region,
            int count,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>([]);

        public Task<IReadOnlyList<HallBookingPeriod>> GetBookingPeriodsAsync(
            IReadOnlyCollection<Guid> hallIds,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallBookingPeriod>>([]);

        public Task<IReadOnlyList<HallAvailability>> GetAvailabilityAsync(
            IReadOnlyCollection<Guid> hallIds,
            DateOnly fromDate,
            DateOnly toDate,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallAvailability>>([]);
    }

    private sealed class FakeConversationRepository : IConversationRepository
    {
        public List<Conversation> Items { get; } = [];

        public Task<Conversation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
            => Task.FromResult(Items.FirstOrDefault(item => item.Id == id));

        public Task<Conversation?> GetByHallAndInitiatorAsync(
            Guid hallId,
            string initiatorUserId,
            CancellationToken cancellationToken = default)
            => Task.FromResult(Items.FirstOrDefault(item =>
                item.HallId == hallId && item.InitiatorUserId == initiatorUserId));

        public Task AddAsync(Conversation conversation, CancellationToken cancellationToken = default)
        {
            Items.Add(conversation);
            return Task.CompletedTask;
        }
    }
}
