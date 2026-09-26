using Microsoft.AspNetCore.SignalR;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.Conversations;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// WESAL-TASK-10 (Edit 10 follow-up): live message delivery must respect a hall lock.
///
/// <para>
/// The notifier used to broadcast to the conversation's SignalR group, which delivers to
/// every member. A hall owner who was refused the thread, both send paths, the conversation
/// read and the attachment download was still in that group and still received every
/// <c>MessageReceived</c> payload — including messages posted while their hall was locked.
/// Because a group broadcast cannot exclude one member, delivery is now resolved per
/// recipient through the same <see cref="ConversationAccess"/> gate the HTTP endpoints use.
/// </para>
/// </summary>
public sealed class ConversationNotifierDeliveryShould
{
    private const string OwnerId = "owner-1";
    private const string SeekerId = "seeker-1";
    private const string AdminId = "admin-1";

    private static readonly Guid ConversationId = Guid.NewGuid();
    private static readonly Guid HallId = Guid.NewGuid();

    // --- The gap: a locked owner must not be delivered to ---

    [Fact]
    public async Task LockedOwner_IsNotDeliveredTheMessage()
    {
        var (notifier, sent) = CreateNotifier(adminLocked: true);

        await notifier.NotifyMessageSentAsync(Event());

        Assert.False(DeliveredTo(sent, OwnerId), "the locked owner must not be delivered to");
    }

    [Fact]
    public async Task SystemLockedOwner_IsNotDeliveredTheMessage()
    {
        var (notifier, sent) = CreateNotifier(systemLocked: true);

        await notifier.NotifyMessageSentAsync(Event());

        Assert.False(DeliveredTo(sent, OwnerId), "the locked owner must not be delivered to");
    }

    /// <summary>
    /// The other party must still be delivered to. A lock is an owner-side restriction, so
    /// withholding from the owner must not also silence the seeker they are talking to.
    /// </summary>
    [Fact]
    public async Task LockedHall_StillDeliversToTheOtherParty()
    {
        var (notifier, sent) = CreateNotifier(adminLocked: true);

        await notifier.NotifyMessageSentAsync(Event());

        Assert.True(DeliveredTo(sent, SeekerId), "the other party must still be delivered to");
    }

    [Fact]
    public async Task LockedHall_StillDeliversToTheAdminCounterparty()
    {
        // owner/Admin thread: the counterparty slot holds the Admin, who is never gated.
        var (notifier, sent) = CreateNotifier(adminLocked: true, systemLocked: true, sender: AdminId);

        await notifier.NotifyMessageSentAsync(Event());

        Assert.True(DeliveredTo(sent, AdminId), "the Admin counterparty must still be delivered to");
        Assert.False(DeliveredTo(sent, OwnerId), "the locked owner must not be delivered to");
    }

    // --- The controls that must keep receiving ---

    [Fact]
    public async Task UnlockedOwner_IsDeliveredTheMessage()
    {
        var (notifier, sent) = CreateNotifier();

        await notifier.NotifyMessageSentAsync(Event());

        Assert.True(DeliveredTo(sent, OwnerId), "an unlocked owner must still be delivered to");
        Assert.True(DeliveredTo(sent, SeekerId), "the other party must still be delivered to");
    }

    /// <summary>
    /// The Edit 4 carve-out must reach the push path, or the owner would be cut off from the
    /// live payment thread in the very conversation they are settling payment in.
    /// </summary>
    [Fact]
    public async Task UnpaidUnlockedOwner_IsStillDeliveredTheMessage()
    {
        var (notifier, sent) = CreateNotifier(payment: HallPaymentStatus.Unpaid);

        await notifier.NotifyMessageSentAsync(Event());

        Assert.True(DeliveredTo(sent, OwnerId), "an unlocked owner must still be delivered to");
    }

    [Fact]
    public async Task PendingReviewOwner_IsStillDeliveredTheMessage()
    {
        // Only an Approved hall is subject to the gate, so review/rejection threads stay live.
        var (notifier, sent) = CreateNotifier(status: HallStatus.PendingReview);

        await notifier.NotifyMessageSentAsync(Event());

        Assert.True(DeliveredTo(sent, OwnerId), "an unlocked owner must still be delivered to");
    }

    [Fact]
    public async Task SystemLockedHall_StillDeliversToTheSeeker()
    {
        var (notifier, sent) = CreateNotifier(systemLocked: true);

        await notifier.NotifyMessageSentAsync(Event());

        Assert.True(DeliveredTo(sent, SeekerId), "the other party must still be delivered to");
    }

    // --- Fail closed rather than leak ---

    [Fact]
    public async Task UnknownConversation_DeliversToNobody()
    {
        var (notifier, sent) = CreateNotifier(conversationExists: false);

        await notifier.NotifyMessageSentAsync(Event());

        Assert.Empty(sent.To);
    }

    [Fact]
    public async Task DeletedHall_DeliversToNobody()
    {
        var (notifier, sent) = CreateNotifier(hallDeleted: true);

        await notifier.NotifyMessageSentAsync(Event());

        Assert.Empty(sent.To);
    }

    // --- Payload integrity ---

    [Fact]
    public async Task DeliveredPayloadIsTheOriginalEventOnTheMessageReceivedChannel()
    {
        var (notifier, sent) = CreateNotifier();
        var message = Event();

        await notifier.NotifyMessageSentAsync(message);

        // Both parties are entitled here, so each gets the same payload on the same channel.
        Assert.Equal(2, sent.To.Count);
        Assert.All(sent.To, delivery =>
        {
            Assert.Equal(ConversationHub.MessageReceived, delivery.Method);
            Assert.Same(message, delivery.Payload);
        });
    }

    [Fact]
    public async Task ASelfConversationIsDeliveredOnceNotTwice()
    {
        var (notifier, sent) = CreateNotifier(sender: OwnerId, hallOwner: OwnerId);

        await notifier.NotifyMessageSentAsync(Event());

        Assert.Single(sent.To);
    }

    private static MessageSentEvent Event() => new()
    {
        MessageId = Guid.NewGuid(),
        ConversationId = ConversationId,
        SenderUserId = SeekerId,
        SenderName = "Seeker",
        Content = "Is the hall available?",
        SentAt = DateTimeOffset.UtcNow
    };

    private static (ConversationNotifier Notifier, Recorder Sent) CreateNotifier(
        HallPaymentStatus payment = HallPaymentStatus.Paid,
        HallStatus status = HallStatus.Approved,
        bool adminLocked = false,
        bool systemLocked = false,
        bool hallDeleted = false,
        bool conversationExists = true,
        string sender = SeekerId,
        string hallOwner = OwnerId)
    {
        var hall = new Hall
        {
            Id = HallId,
            Status = status,
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
                SenderUserId = sender,
                HallOwnerId = hallOwner,
                Hall = hall
            }
            : null;

        var sent = new Recorder();

        return (new ConversationNotifier(
            new StubHubContext(sent),
            new StubConversationRepository(conversation)), sent);
    }

    private sealed class Delivery
    {
        public required string UserId { get; init; }
        public required string Method { get; init; }
        public required object? Payload { get; init; }
    }

    /// <summary>Whether the message was delivered to this specific user's connections.</summary>
    private static bool DeliveredTo(Recorder sent, string userId)
        => sent.To.Any(delivery => string.Equals(delivery.UserId, userId, StringComparison.OrdinalIgnoreCase));

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

        public IClientProxy Group(string groupName) => new RecordingProxy(_recorder, $"group:{groupName}");

        public IClientProxy Groups(IReadOnlyList<string> groupNames) => new RecordingProxy(_recorder, "*groups*");

        public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) => new RecordingProxy(_recorder, $"group-except:{groupName}");

        public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds, string method) => new RecordingProxy(_recorder, $"group-except:{groupName}");

        public IClientProxy UserGroups(string userId, IReadOnlyList<string> groupNames) => new RecordingProxy(_recorder, $"user-groups:{userId}");

        public IClientProxy UserGroups(string userId, IReadOnlyList<string> groupNames, string method) => new RecordingProxy(_recorder, $"user-groups:{userId}");

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
            _recorder.To.Add(new Delivery
            {
                UserId = _userId,
                Method = method,
                Payload = args.Length > 0 ? args[0] : null
            });

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
