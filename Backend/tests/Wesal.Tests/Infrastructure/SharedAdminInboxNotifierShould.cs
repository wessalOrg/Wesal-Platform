using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// WESAL-TASK-10, Edit 16: the LIVE half of the shared inbox.
/// <para>
/// The HTTP inbox tests prove Admins can find a shared thread; these prove they are pushed to
/// it. Before Edit 16 the notifier resolved recipients from the conversation row, so on an
/// owner/Admin thread that is one Admin — the individual stored in <c>SenderUserId</c> — plus
/// the owner. In production that meant four of the five Admins were never notified about a
/// payment proof at all, no matter how loudly the owner wrote in.
/// </para>
/// <para>
/// The repository here is the REAL one over a real in-memory database with real Identity role
/// rows, not a stub. The whole point of Edit 16 is that the Admin audience is resolved from the
/// <c>Admin</c> ROLE at send time, so a stub returning an empty list — which is what the shipped
/// test doubles do by default — would make the fan-out untestable and silently unverified.
/// </para>
/// <para>
/// Delivery must stay PER RECIPIENT. Edit 10 moved it off SignalR groups specifically so a
/// locked hall owner can be withheld from while everyone else still receives; a group broadcast
/// cannot exclude one member, so reintroducing one to reach several Admins would silently undo
/// that fix. Every test below therefore asserts on individual user targets, never a group.
/// </para>
/// </summary>
public sealed class SharedAdminInboxNotifierShould : IDisposable
{
    private const string OwnerId = "owner-1";
    private const string AdminOne = "admin-one";
    private const string AdminTwo = "admin-two";
    private const string AdminThree = "admin-three";
    private const string SeekerId = "seeker-1";

    private readonly ApplicationDbContext _context = CreateContext();

    public SharedAdminInboxNotifierShould()
    {
        _context.Roles.Add(new ApplicationRole
        {
            Id = "admin-role",
            Name = ApplicationRoles.Admin,
            NormalizedName = ApplicationRoles.Admin.ToUpperInvariant()
        });
        _context.SaveChanges();

        foreach (var adminUserId in new[] { AdminOne, AdminTwo, AdminThree })
        {
            _context.UserRoles.Add(new IdentityUserRole<string>
            {
                UserId = adminUserId,
                RoleId = "admin-role"
            });
        }

        _context.SaveChanges();
    }

    public void Dispose() => _context.Dispose();

    // =====================================================================
    // The fan-out
    // =====================================================================

    /// <summary>
    /// The requirement in one assertion: an owner writes in an owner/Admin thread, and EVERY
    /// Admin is pushed to, not only the one the thread happens to name.
    /// </summary>
    [Fact]
    public async Task AnOwnerMessage_IsPushedToEveryAdmin_NotJustTheStoredCounterparty()
    {
        var conversation = SeedConversation(sender: AdminOne, hallOwnerId: OwnerId);

        await Notify(conversation.Id);

        Assert.True(DeliveredTo(AdminOne));
        Assert.True(DeliveredTo(AdminTwo));
        Assert.True(DeliveredTo(AdminThree));
        Assert.True(DeliveredTo(OwnerId));

        Assert.Equal(4, UniqueRecipients().Count);
    }

    /// <summary>
    /// The reply direction matters just as much: when one Admin answers, the whole team and the
    /// owner see it, because the next person in the queue may be any of them.
    /// </summary>
    [Fact]
    public async Task AnAdminsReply_IsPushedToTheOtherAdminsAndTheOwner()
    {
        var conversation = SeedConversation(sender: AdminOne, hallOwnerId: OwnerId);

        await Notify(conversation.Id, sentBy: AdminTwo);

        Assert.True(DeliveredTo(OwnerId));
        Assert.True(DeliveredTo(AdminOne));
        Assert.True(DeliveredTo(AdminThree));

        // And nobody is pushed twice just because they are both a party and an Admin.
        Assert.Equal(4, UniqueRecipients().Count);
    }

    /// <summary>
    /// A thread opened by the owner themselves names the <c>admin</c> sentinel, so the stored
    /// counterparty is nobody. The push must still reach the whole team — this is the "Contact
    /// Admin" flow, and it is the case where a row-based resolver delivers to literally no one.
    /// </summary>
    [Fact]
    public async Task AThreadWhoseStoredCounterpartyIsTheAdminSentinel_StillReachesEveryAdmin()
    {
        var conversation = SeedConversation(sender: PlatformSenders.AdminFallback, hallOwnerId: OwnerId);

        await Notify(conversation.Id);

        Assert.True(DeliveredTo(AdminOne));
        Assert.True(DeliveredTo(AdminTwo));
        Assert.True(DeliveredTo(AdminThree));
        Assert.True(DeliveredTo(OwnerId));

        // The sentinel itself is not a delivery target — there is no such connection.
        Assert.DoesNotContain(PlatformSenders.AdminFallback, _sent.To.Select(d => d.UserId), StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// An automated platform notice names <c>system</c> and reaches the team for the same
    /// reason, while the sentinel is likewise never messaged.
    /// </summary>
    [Fact]
    public async Task APlatformNotice_ReachesEveryAdminAndNeverTheSystemSentinel()
    {
        var conversation = SeedConversation(sender: PlatformSenders.System, hallOwnerId: OwnerId);

        await Notify(conversation.Id);

        Assert.True(DeliveredTo(AdminOne));
        Assert.True(DeliveredTo(AdminTwo));
        Assert.True(DeliveredTo(AdminThree));

        Assert.DoesNotContain(PlatformSenders.System, _sent.To.Select(d => d.UserId), StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// The audience is resolved from the ROLE at send time, so a newly created Admin account
    /// starts receiving pushes on the very next message with no redeploy and no code change.
    /// This is what makes "every Admin" a live property rather than a one-off.
    /// </summary>
    [Fact]
    public async Task AnAdminCreatedAfterTheThread_StillReceivesTheNextMessage()
    {
        var conversation = SeedConversation(sender: AdminOne, hallOwnerId: OwnerId);

        // A fourth Admin is provisioned after the conversation already exists.
        const string lateAdmin = "admin-four";
        _context.UserRoles.Add(new IdentityUserRole<string> { UserId = lateAdmin, RoleId = "admin-role" });
        _context.SaveChanges();

        await Notify(conversation.Id);

        Assert.True(DeliveredTo(lateAdmin));
    }

    /// <summary>
    /// Conversely, a revoked Admin stops being pushed to, so a deactivated account is not kept
    /// in the loop by a stale cache.
    /// </summary>
    [Fact]
    public async Task AnAdminWhoLostTheRole_StopsReceivingPushes()
    {
        var conversation = SeedConversation(sender: AdminOne, hallOwnerId: OwnerId);

        var role = _context.UserRoles.Single(r => r.UserId == AdminThree);
        _context.UserRoles.Remove(role);
        _context.SaveChanges();

        await Notify(conversation.Id);

        Assert.False(DeliveredTo(AdminThree));
        Assert.True(DeliveredTo(AdminOne));
        Assert.True(DeliveredTo(AdminTwo));
    }

    // =====================================================================
    // Edit 10's lock gate must survive the wider audience
    // =====================================================================

    /// <summary>
    /// THE regression risk of widening the audience. Edit 10 withholds pushes from a locked hall
    /// owner while still delivering to everyone else; now that "everyone else" is the whole
    /// Admin team, a mistake in the ordering would withhold from the Admins — the parties the
    /// lock never restricts — instead of from the owner.
    /// </summary>
    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task ALockedOwnerIsWithheld_WhileEveryAdminStillReceives(bool adminLocked, bool systemLocked)
    {
        var conversation = SeedConversation(
            sender: AdminOne,
            hallOwnerId: OwnerId,
            adminLocked: adminLocked,
            systemLocked: systemLocked);

        await Notify(conversation.Id);

        Assert.False(DeliveredTo(OwnerId), "a locked owner must be withheld");
        Assert.True(DeliveredTo(AdminOne));
        Assert.True(DeliveredTo(AdminTwo));
        Assert.True(DeliveredTo(AdminThree));
    }

    /// <summary>
    /// Edit 4's carve-out, on the push path: an Approved-but-UNPAID and unlocked owner is inside
    /// the settlement conversation and must keep receiving the live thread. Withholding them
    /// here would leave an owner paying with no confirmation.
    /// </summary>
    [Fact]
    public async Task AnUnpaidUnlockedOwner_StillReceivesThePush()
    {
        var conversation = SeedConversation(
            sender: AdminOne,
            hallOwnerId: OwnerId,
            payment: HallPaymentStatus.Unpaid);

        await Notify(conversation.Id);

        Assert.True(DeliveredTo(OwnerId));
        Assert.True(DeliveredTo(AdminTwo));
    }

    // =====================================================================
    // The seeker/owner seam must be untouched
    // =====================================================================

    /// <summary>
    /// The negative control for the whole feature. A seeker's thread is not shared, so widening
    /// the Admin audience must NOT drag the whole admin team into a private conversation between
    /// a seeker and one hall owner. This is the single most important assertion in the file.
    /// </summary>
    [Fact]
    public async Task ASeekerOwnerThread_ReachesOnlyItsTwoParties_AndNoAdmin()
    {
        var conversation = SeedConversation(sender: SeekerId, hallOwnerId: OwnerId);

        await Notify(conversation.Id);

        Assert.True(DeliveredTo(SeekerId));
        Assert.True(DeliveredTo(OwnerId));

        Assert.False(DeliveredTo(AdminOne));
        Assert.False(DeliveredTo(AdminTwo));
        Assert.False(DeliveredTo(AdminThree));

        Assert.Equal(2, UniqueRecipients().Count);
    }

    /// <summary>
    /// A seeker replying on their own thread is unchanged: the owner is still the only recipient.
    /// </summary>
    [Fact]
    public async Task ASeekerReply_ReachesOnlyTheOwner()
    {
        var conversation = SeedConversation(sender: SeekerId, hallOwnerId: OwnerId);

        await Notify(conversation.Id, sentBy: SeekerId);

        Assert.True(DeliveredTo(OwnerId));
        Assert.Equal(2, UniqueRecipients().Count);
    }

    // =====================================================================
    // Delivery mechanism
    // =====================================================================

    /// <summary>
    /// A group broadcast is the specific regression Edit 10 fixed, and it is the tempting way to
    /// "deliver to all Admins at once". Pinned so the shortcut cannot come back unnoticed.
    /// </summary>
    [Fact]
    public async Task DeliveryIsAlwaysPerRecipient_AndNeverAGroupBroadcast()
    {
        var conversation = SeedConversation(sender: AdminOne, hallOwnerId: OwnerId);

        await Notify(conversation.Id);

        Assert.NotEmpty(_sent.To);

        // Every push went to an individual user target with a real user id — not "*group*",
        // not "*all*", not "*users*".
        foreach (var delivery in _sent.To)
        {
            Assert.DoesNotContain("*", delivery.UserId);
            Assert.Equal(ConversationHub.MessageReceived, delivery.Method);
        }
    }

    /// <summary>
    /// Each recipient gets their own push rather than a single grouped one, which is what lets
    /// SignalR skip the ones with no live connection without any connection tracking here.
    /// </summary>
    [Fact]
    public async Task EachAdminGetsAnIndividualPush()
    {
        var conversation = SeedConversation(sender: AdminOne, hallOwnerId: OwnerId);

        await Notify(conversation.Id);

        var adminDeliveries = _sent.To
            .Where(d => d.UserId is AdminOne or AdminTwo or AdminThree)
            .ToList();

        Assert.Equal(3, adminDeliveries.Count);
        Assert.Equal(3, adminDeliveries.Select(d => d.UserId).Distinct(StringComparer.OrdinalIgnoreCase).Count());
    }

    // =====================================================================
    // Fail-closed behaviour, carried over from Edit 10
    // =====================================================================

    /// <summary>
    /// If the thread cannot be resolved, nobody is authorised to receive it. A wider audience
    /// makes this MORE dangerous, not less, so the guard is pinned: the fan-out is built from a
    /// row, and without one there is nothing to authorise.
    /// </summary>
    [Fact]
    public async Task AnUnresolvableThreadIsNotDeliveredToAnyone()
    {
        await Notify(Guid.NewGuid());

        Assert.Empty(_sent.To);
    }

    /// <summary>
    /// A thread whose hall was soft-deleted is equally not deliverable, for the same reason.
    /// </summary>
    [Fact]
    public async Task AThreadOnADeletedHallIsNotDeliveredToAnyone()
    {
        var conversation = SeedConversation(sender: AdminOne, hallOwnerId: OwnerId, hallDeleted: true);

        await Notify(conversation.Id);

        Assert.Empty(_sent.To);
    }

    // =====================================================================
    // Harness
    // =====================================================================

    private readonly Recorder _sent = new();

    private List<string> UniqueRecipients()
        => _sent.To.Select(d => d.UserId).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

    private bool DeliveredTo(string userId)
        => _sent.To.Any(d => string.Equals(d.UserId, userId, StringComparison.OrdinalIgnoreCase));

    private async Task Notify(Guid conversationId, string sentBy = OwnerId)
    {
        var notifier = new ConversationNotifier(new StubHubContext(_sent), new ConversationRepository(_context));

        await notifier.NotifyMessageSentAsync(new MessageSentEvent
        {
            MessageId = Guid.NewGuid(),
            ConversationId = conversationId,
            SenderUserId = sentBy,
            SenderName = "Someone",
            Content = "a message",
            SentAt = DateTimeOffset.UtcNow
        });
    }

    private Conversation SeedConversation(
        string sender,
        string hallOwnerId,
        HallPaymentStatus payment = HallPaymentStatus.Paid,
        bool adminLocked = false,
        bool systemLocked = false,
        bool hallDeleted = false)
    {
        var hall = new Hall
        {
            Id = Guid.NewGuid(),
            Name = "Test Hall",
            Status = HallStatus.Approved,
            PaymentStatus = payment,
            OwnerId = hallOwnerId,
            Address = "Gaza",
            Region = HallRegion.Gaza,
            Capacity = 100,
            IsAdminLocked = adminLocked,
            SystemLocked = systemLocked,
            IsDeleted = hallDeleted
        };

        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            SenderUserId = sender,
            HallOwnerId = hallOwnerId,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _context.Halls.Add(hall);
        _context.Conversations.Add(conversation);
        _context.SaveChanges();

        return conversation;
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new ApplicationDbContext(options);
    }

    private sealed class Delivery
    {
        public required string UserId { get; init; }
        public required string Method { get; init; }
    }

    private sealed class Recorder
    {
        public List<Delivery> To { get; } = [];
    }

    private sealed class StubHubContext : IHubContext<ConversationHub>
    {
        private readonly Recorder _recorder;

        public StubHubContext(Recorder recorder)
        {
            _recorder = recorder;
            Clients = new StubClients(recorder);
            Groups = new StubGroups();
        }

        public IHubClients Clients { get; }

        public IGroupManager Groups { get; }
    }

    private sealed class StubClients : IHubClients
    {
        private readonly Recorder _recorder;

        public StubClients(Recorder recorder) => _recorder = recorder;

        public IClientProxy User(string userId) => new RecordingProxy(_recorder, userId);

        public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) => new RecordingProxy(_recorder, "*all-except*");

        public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds, string groupName) => new RecordingProxy(_recorder, "*all-except-group*");

        public IClientProxy Client(string connectionId) => new RecordingProxy(_recorder, $"connection:{connectionId}");

        public IClientProxy All => new RecordingProxy(_recorder, "*all*");

        public IClientProxy Clients(IReadOnlyList<string> connectionIds) => new RecordingProxy(_recorder, "*connections*");

        public IClientProxy Group(string groupName) => new RecordingProxy(_recorder, $"*group:{groupName}*");

        public IClientProxy Groups(IReadOnlyList<string> groupNames) => new RecordingProxy(_recorder, "*groups*");

        public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) => new RecordingProxy(_recorder, "*group-except*");

        public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds, string method) => new RecordingProxy(_recorder, "*group-except*");

        public IClientProxy UserGroups(string userId, IReadOnlyList<string> groupNames) => new RecordingProxy(_recorder, "*user-groups*");

        public IClientProxy UserGroups(string userId, IReadOnlyList<string> groupNames, string method) => new RecordingProxy(_recorder, "*user-groups*");

        public IClientProxy Users(IReadOnlyList<string> userIds) => new RecordingProxy(_recorder, "*users*");
    }

    private sealed class RecordingProxy : IClientProxy
    {
        private readonly Recorder _recorder;
        private readonly string _userId;

        public RecordingProxy(Recorder recorder, string userId)
        {
            _recorder = recorder;
            _userId = userId;
        }

        public Task SendCoreAsync(string method, object?[] args, CancellationToken cancellationToken = default)
        {
            _recorder.To.Add(new Delivery { UserId = _userId, Method = method });

            return Task.CompletedTask;
        }
    }

    private sealed class StubGroups : IGroupManager
    {
        public Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task RemoveFromGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

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
}
