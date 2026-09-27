using System.Security.Claims;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.SignalR;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Conversations;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// WESAL-TASK-10 (Edit 10 follow-up): the SignalR side of a hall lock.
///
/// <para>
/// The live group was the one transport that never applied the hall-messaging gate. An
/// owner whose hall was Admin-locked or system-locked was refused the thread, both send
/// paths, the conversation read and the attachment download, and could still call
/// <c>JoinConversation</c> and receive every subsequent <c>MessageReceived</c> payload for
/// that thread. A lock that leaves a live channel open is not a lock.
/// </para>
/// </summary>
public sealed class ConversationHubAccessShould
{
    private const string OwnerId = "owner-1";
    private const string SeekerId = "seeker-1";
    private const string AdminId = "admin-1";

    private static readonly Guid ConversationId = Guid.NewGuid();
    private static readonly Guid HallId = Guid.NewGuid();

    // --- Joining is refused for a locked owner ---

    [Fact]
    public async Task Join_AdminLockedOwner_IsRefusedWithTheLockReason()
    {
        var hub = CreateHub(OwnerId, [ApplicationRoles.HallOwner], adminLocked: true);

        var ex = await Assert.ThrowsAsync<HubException>(() => hub.JoinConversation(ConversationId));

        // The reason code travels in the message so the client can show the locked notice.
        Assert.Contains(HallManagementAccess.HallLockedCode, ex.Message);
        Assert.Empty(hub.JoinedGroups);
    }

    [Fact]
    public async Task Join_PaidOwnerAdminLocked_IsRefused()
    {
        var hub = CreateHub(OwnerId, [ApplicationRoles.HallOwner], adminLocked: true, payment: HallPaymentStatus.Paid);

        await Assert.ThrowsAsync<HubException>(() => hub.JoinConversation(ConversationId));

        Assert.Empty(hub.JoinedGroups);
    }

    [Fact]
    public async Task Join_PaidOwnerSystemLocked_IsRefused()
    {
        var hub = CreateHub(OwnerId, [ApplicationRoles.HallOwner], systemLocked: true, payment: HallPaymentStatus.Paid);

        await Assert.ThrowsAsync<HubException>(() => hub.JoinConversation(ConversationId));

        Assert.Empty(hub.JoinedGroups);
    }

    // --- The controls that must keep working ---

    /// <summary>
    /// The Edit 4 carve-out has to reach the hub too, otherwise the fix above would cut the
    /// owner off from the live payment thread in the very conversation they are settling
    /// payment in.
    /// </summary>
    [Fact]
    public async Task Join_UnpaidOwner_CanStillJoinTheirOwnPaymentThread()
    {
        var hub = CreateHub(OwnerId, [ApplicationRoles.HallOwner], payment: HallPaymentStatus.Unpaid);

        await hub.JoinConversation(ConversationId);

        Assert.Equal([ConversationId.ToString()], hub.JoinedGroups);
    }

    [Fact]
    public async Task Join_PaidOwner_JoinsNormally()
    {
        var hub = CreateHub(OwnerId, [ApplicationRoles.HallOwner]);

        await hub.JoinConversation(ConversationId);

        Assert.Equal([ConversationId.ToString()], hub.JoinedGroups);
    }

    [Fact]
    public async Task Join_SeekerParticipant_IsRefusedOnALockedHall()
    {
        // Edit 16: a user must not join or send in a thread concerning a manually
        // locked/suspended (or system-locked) hall, with the same unavailable message
        // used for bookings and HTTP message paths. The inbox already drops locked
        // threads (Edit 14), so letting a seeker join the live group would be the same
        // partial-enforcement bypass the gate exists to close. Admins still join.
        var hub = CreateHub(SeekerId, [ApplicationRoles.RegisteredUser], adminLocked: true);

        var ex = await Assert.ThrowsAsync<HubException>(() => hub.JoinConversation(ConversationId));

        Assert.Contains("للأسف, هاي الصالة غير متاحة حاليا", ex.Message, StringComparison.Ordinal);
        Assert.Empty(hub.JoinedGroups);
    }

    [Fact]
    public async Task Join_Admin_JoinsOnALockedHall()
    {
        var hub = CreateHub(AdminId, [ApplicationRoles.Admin], adminLocked: true, systemLocked: true);

        await hub.JoinConversation(ConversationId);

        Assert.Equal([ConversationId.ToString()], hub.JoinedGroups);
    }

    // --- Pre-existing hub behaviour that must not regress ---

    [Fact]
    public async Task Join_NonParticipant_IsRefused()
    {
        var hub = CreateHub("stranger", [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<HubException>(() => hub.JoinConversation(ConversationId));

        Assert.Empty(hub.JoinedGroups);
    }

    [Fact]
    public async Task Join_Unauthenticated_IsRefused()
    {
        var hub = CreateHub(null, []);

        await Assert.ThrowsAsync<HubException>(() => hub.JoinConversation(ConversationId));

        Assert.Empty(hub.JoinedGroups);
    }

    [Fact]
    public async Task Join_DeletedHall_IsRefused()
    {
        var hub = CreateHub(OwnerId, [ApplicationRoles.HallOwner], hallDeleted: true);

        await Assert.ThrowsAsync<HubException>(() => hub.JoinConversation(ConversationId));

        Assert.Empty(hub.JoinedGroups);
    }

    [Fact]
    public async Task Join_UnknownConversation_IsRefused()
    {
        var hub = CreateHub(OwnerId, [ApplicationRoles.HallOwner], conversationExists: false);

        await Assert.ThrowsAsync<HubException>(() => hub.JoinConversation(ConversationId));

        Assert.Empty(hub.JoinedGroups);
    }

    [Fact]
    public async Task Leave_RemovesFromTheGroup()
    {
        var hub = CreateHub(OwnerId, [ApplicationRoles.HallOwner]);
        await hub.JoinConversation(ConversationId);

        await hub.LeaveConversation(ConversationId);

        Assert.Empty(hub.JoinedGroups);
    }

    // --- The live-push half: an already-connected locked owner is refused new messages ---

    /// <summary>
    /// A join check alone is not enough. A lock applied AFTER the owner joined must still stop
    /// the live messages, or the owner simply never re-joins and keeps receiving the thread.
    /// </summary>
    [Fact]
    public async Task Push_OwnerJoinedBeforeTheLock_StopsReceivingMessages()
    {
        var hub = CreateHub(OwnerId, [ApplicationRoles.HallOwner]);
        await hub.JoinConversation(ConversationId);

        // The hall is locked after the fact.
        var locked = CreateHub(OwnerId, [ApplicationRoles.HallOwner], adminLocked: true);

        Assert.False(await locked.Guard.CanReceiveLiveMessagesAsync(ConversationId));
    }

    [Fact]
    public async Task Push_OwnerJoinedBeforeTheLock_WasReceivingWhileUnlocked()
    {
        var hub = CreateHub(OwnerId, [ApplicationRoles.HallOwner]);
        await hub.JoinConversation(ConversationId);

        Assert.True(await hub.Guard.CanReceiveLiveMessagesAsync(ConversationId));
    }

    private static TestableConversationHub CreateHub(
        string? userId,
        IReadOnlyList<string> roles,
        HallPaymentStatus payment = HallPaymentStatus.Paid,
        bool adminLocked = false,
        bool systemLocked = false,
        bool hallDeleted = false,
        bool conversationExists = true)
    {
        var hall = new Hall
        {
            Id = HallId,
            Status = HallStatus.Approved,
            PaymentStatus = payment,
            IsAdminLocked = adminLocked,
            SystemLocked = systemLocked,
            IsDeleted = hallDeleted
        };

        Conversation? conversation = conversationExists
            ? new Conversation
            {
                Id = ConversationId,
                HallId = HallId,
                SenderUserId = SeekerId,
                HallOwnerId = OwnerId,
                Hall = hall
            }
            : null;

        var currentUser = new TestCurrentUser(userId, roles);
        var guard = new ConversationThreadGuard(new StubConversationRepository(conversation), currentUser);

        return new TestableConversationHub(guard);
    }

    /// <summary>
    /// Exposes the group joins so the tests can assert both halves of the contract: a refused
    /// join must add the connection to NO group, and an allowed join must add it to exactly
    /// the requested one. <c>Hub.Context</c> and <c>Hub.Groups</c> are abstract, so the hub is
    /// unsealed and this seam overrides them.
    /// </summary>
    private sealed class TestableConversationHub : ConversationHub
    {
        public TestableConversationHub(ConversationThreadGuard guard) : base(guard)
        {
            Guard = guard;
            Groups = new RecordingGroupManager();
            Context = new StubCallerContext();
        }

        public ConversationThreadGuard Guard { get; }

        public RecordingGroupManager Recorder => (RecordingGroupManager)Groups;

        public List<string> JoinedGroups => Recorder.JoinedGroups;
    }

    private sealed class RecordingGroupManager : IGroupManager
    {
        public List<string> JoinedGroups { get; } = [];

        public Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
        {
            JoinedGroups.Add(groupName);
            return Task.CompletedTask;
        }

        public Task RemoveFromGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
        {
            JoinedGroups.Remove(groupName);
            return Task.CompletedTask;
        }

        public Task AddToGroupAsync(IEnumerable<string> connectionIds, string groupName, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task RemoveFromGroupAsync(IEnumerable<string> connectionIds, string groupName, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public async IAsyncEnumerable<string> GetConnectionsInGroup(
            string groupName,
            [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            await Task.CompletedTask;
            yield break;
        }
    }

    private sealed class StubCallerContext : HubCallerContext
    {
        public override string ConnectionId => "test-connection";

        public override string? UserIdentifier { get; }

        public override ClaimsPrincipal User { get; } = new();

        public override IDictionary<object, object?> Items { get; } = new Dictionary<object, object?>();

        public override IFeatureCollection Features { get; } = new FeatureCollection();

        public override CancellationToken ConnectionAborted => CancellationToken.None;

        public override void Abort() { }
    }

    private sealed class TestCurrentUser : ICurrentUserService
    {
        public TestCurrentUser(string? userId, IReadOnlyList<string> roles)
        {
            UserId = userId;
            Roles = roles;
        }

        public string? UserId { get; }

        public string? UserName => "test";

        public string? Email => "test@example.com";

        public bool IsAuthenticated => UserId is not null;

        public IReadOnlyList<string> Roles { get; }
    }

    private sealed class StubConversationRepository : IConversationRepository
    {
        private readonly Conversation? _conversation;

        public StubConversationRepository(Conversation? conversation) => _conversation = conversation;

        public Task<Conversation?> GetByIdWithHallAsync(Guid conversationId, CancellationToken cancellationToken = default)
            => Task.FromResult(_conversation is not null && _conversation.Id == conversationId ? _conversation : null);

        public Task<Conversation?> GetByHallAndUserAsync(Guid hallId, string userId, CancellationToken cancellationToken = default)
            => Task.FromResult<Conversation?>(null);

        public Task<Conversation?> GetByHallForOwnerAsync(Guid hallId, string ownerId, CancellationToken cancellationToken = default)
            => Task.FromResult<Conversation?>(null);

        public Task AddAsync(Conversation conversation, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<IReadOnlyList<Conversation>> GetParticipantConversationsAsync(string userId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Conversation>>(_conversation is null ? [] : [_conversation]);

        public Task<IReadOnlyList<UserDisplayInfo>> GetUserDisplayNamesAsync(IReadOnlyCollection<string> userIds, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<UserDisplayInfo>>([]);

        public Task UpsertReadStateAsync(Guid conversationId, string userId, DateTimeOffset lastReadAt, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task HideConversationAsync(Guid conversationId, string userId, DateTimeOffset hiddenAt, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<int> GetUnreadConversationCountAsync(string userId, bool isAdmin, CancellationToken cancellationToken = default)
            => Task.FromResult(0);

        public Task<Dictionary<Guid, bool>> GetUnreadStatusAsync(string userId, IReadOnlyCollection<Guid> conversationIds, CancellationToken cancellationToken = default)
            => Task.FromResult<Dictionary<Guid, bool>>([]);
    }
}
