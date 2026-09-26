using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Bookings;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Documents;
using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// WESAL-TASK-10 (Edit 10): the end-to-end messaging crash sweep.
/// </summary>
/// <remarks>
/// <para>
/// Every test here reproduces a defect that produced an unhandled <c>500</c> for a real caller
/// (or, in the deleted-hall case, a <c>200</c> that answered a question no sibling endpoint
/// would answer). Each was written to fail before its fix; the comment on each states the
/// concrete symptom so the regression is obvious if it ever returns.
/// </para>
/// <para>
/// These are deliberately crash-and-consistency fixes only. No access-control rule was
/// loosened, and the Edit 4 unpaid-owner payment-thread carve-out is covered by the scope
/// proofs in <see cref="ConversationAttachmentMessageShould"/>, which must keep passing.
/// </para>
/// </remarks>
public sealed class MessagingCrashSweepShould : IDisposable
{
    private static readonly Guid ConversationId = Guid.NewGuid();
    private static readonly Guid HallId = Guid.NewGuid();
    private const string OwnerId = "owner-1";
    private const string SeekerId = "seeker-1";
    private const string AdminId = "admin-1";

    private readonly string _root;

    public MessagingCrashSweepShould()
    {
        _root = Path.Combine(Path.GetTempPath(), "wesal-crash-sweep", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_root);
    }

    public void Dispose()
    {
        try
        {
            if (Directory.Exists(_root))
            {
                Directory.Delete(_root, recursive: true);
            }
        }
        catch (IOException)
        {
            // Best-effort cleanup; a leftover temp directory must not fail the suite.
        }
    }

    private static byte[] Png() =>
    [
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52
    ];

    private sealed class Harness
    {
        public required ConversationService Service { get; init; }

        public required FakeConversationRepository Conversations { get; init; }

        public required FakeMessageRepository Messages { get; init; }

        public required FakeDocumentStorage Storage { get; init; }

        public required Hall Hall { get; init; }
    }

    private Harness CreateHarness(
        string? userId,
        IReadOnlyList<string> roles,
        Hall? hall = null,
        Conversation? conversation = null)
    {
        var effectiveHall = hall ?? new Hall
        {
            Id = HallId,
            Name = "Grand Hall",
            Status = HallStatus.Approved,
            PaymentStatus = HallPaymentStatus.Paid,
            OwnerId = OwnerId
        };

        var effectiveConversation = conversation ?? new Conversation
        {
            Id = ConversationId,
            HallId = effectiveHall.Id,
            SenderUserId = AdminId,
            HallOwnerId = OwnerId,
            Hall = effectiveHall
        };

        var conversations = new FakeConversationRepository(effectiveConversation);
        var messages = new FakeMessageRepository();
        var storage = new FakeDocumentStorage(_root);

        return new Harness
        {
            Service = new ConversationService(
                conversations,
                messages,
                new FakeBookingRejectionService(),
                new NoOpBookingAcceptanceService(),
                new FakeHallRepository(effectiveHall),
                new FakeCurrentUserService(userId, roles),
                new FakeConversationNotifier(),
                storage),
            Conversations = conversations,
            Messages = messages,
            Storage = storage,
            Hall = effectiveHall
        };
    }

    // ======================================================================================
    // Crash 1: an approved hall with no owner produced a row the database refuses.
    //
    // Hall.OwnerId is string?, but Conversation.HallOwnerId maps to a NOT NULL column. The
    // null-forgiving "!" only silenced the compiler, so the insert reached the database and
    // failed there, surfacing as an unhandled 500. Three sibling services
    // (BookingRejectionService, BookingAcceptanceService, AdminHallReviewService) all guard
    // this; only the seeker-initiated path did not.
    // ======================================================================================

    [Fact]
    public async Task CreateConversation_HallWithoutOwner_RefusesInsteadOfWritingAnUnpersistableRow()
    {
        var hall = new Hall
        {
            Id = HallId,
            Name = "Ownerless Hall",
            Status = HallStatus.Approved,
            PaymentStatus = HallPaymentStatus.Paid,
            OwnerId = null
        };

        var harness = CreateHarness(
            SeekerId,
            [ApplicationRoles.RegisteredUser],
            hall: hall,
            conversation: new Conversation
            {
                Id = Guid.NewGuid(),
                HallId = hall.Id,
                SenderUserId = SeekerId,
                HallOwnerId = OwnerId,
                Hall = hall
            });

        await Assert.ThrowsAsync<NotFoundException>(() => harness.Service.CreateConversationAsync(hall.Id));

        Assert.Empty(harness.Conversations.Added);
    }

    [Fact]
    public async Task CreateConversation_HallWithWhitespaceOwner_RefusesToo()
    {
        // Whitespace is not a usable participant id, and it is what an ownerless hall is most
        // likely to carry after a bad import.
        var hall = new Hall
        {
            Id = HallId,
            Name = "Blank Owner Hall",
            Status = HallStatus.Approved,
            PaymentStatus = HallPaymentStatus.Paid,
            OwnerId = "   "
        };

        var harness = CreateHarness(
            SeekerId,
            [ApplicationRoles.RegisteredUser],
            hall: hall,
            conversation: new Conversation
            {
                Id = Guid.NewGuid(),
                HallId = hall.Id,
                SenderUserId = SeekerId,
                HallOwnerId = OwnerId,
                Hall = hall
            });

        await Assert.ThrowsAsync<NotFoundException>(() => harness.Service.CreateConversationAsync(hall.Id));

        Assert.Empty(harness.Conversations.Added);
    }

    [Fact]
    public async Task CreateConversation_HallWithOwner_StillWorks()
    {
        // The guard must not break the ordinary path. The seeded conversation belongs to a
        // different seeker, so this genuinely exercises creation rather than the reuse branch.
        var hall = new Hall
        {
            Id = HallId,
            Name = "Grand Hall",
            Status = HallStatus.Approved,
            PaymentStatus = HallPaymentStatus.Paid,
            OwnerId = OwnerId
        };

        var harness = CreateHarness(
            SeekerId,
            [ApplicationRoles.RegisteredUser],
            hall: hall,
            conversation: new Conversation
            {
                Id = Guid.NewGuid(),
                HallId = hall.Id,
                SenderUserId = "somebody-else",
                HallOwnerId = OwnerId,
                Hall = hall
            });

        var result = await harness.Service.CreateConversationAsync(hall.Id);

        Assert.Equal(hall.Id, result.HallId);
        Assert.Equal(OwnerId, result.OwnerUserId);
        var created = Assert.Single(harness.Conversations.Added);
        Assert.Equal(SeekerId, created.SenderUserId);
        Assert.Equal(OwnerId, created.HallOwnerId);
    }

    // ======================================================================================
    // Crash 2: the attachment endpoint's clientRequestId had no length limit.
    //
    // The text endpoint validates ClientRequestId at 450 via SendMessageRequestValidator, and
    // the column is 450 wide. The attachment endpoint takes the same value as a raw form
    // field, which no validator covers, so a longer value reached the insert and came back as
    // an unhandled database error (500) instead of the 400 the identical text-path input gets.
    // ======================================================================================

    [Fact]
    public async Task SendAttachment_ClientRequestIdOver450_IsRejectedBeforeAnythingIsWritten()
    {
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);

        var error = await Assert.ThrowsAsync<ValidationException>(() =>
            harness.Service.SendAttachmentMessageAsync(
                ConversationId,
                new MessageAttachmentUpload { FileName = "proof.png", ContentType = "image/png", Content = Png() },
                null,
                new string('r', 451)));

        Assert.Contains("450", error.Message, StringComparison.Ordinal);

        Assert.Empty(harness.Messages.Committed);

        var directory = harness.Storage.ConversationAttachmentsDirectory(ConversationId);
        Assert.False(Directory.Exists(directory) && Directory.EnumerateFiles(directory).Any());
    }

    [Fact]
    public async Task SendAttachment_ClientRequestIdAt450_IsAccepted()
    {
        // Boundary: the limit is inclusive, matching the text path and the column.
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);

        var result = await harness.Service.SendAttachmentMessageAsync(
            ConversationId,
            new MessageAttachmentUpload { FileName = "proof.png", ContentType = "image/png", Content = Png() },
            null,
            new string('r', 450));

        Assert.True(result.HasAttachment);
        Assert.Equal(450, Assert.Single(harness.Messages.Committed).ClientRequestId!.Length);
    }

    [Fact]
    public async Task SendAttachment_BlankClientRequestId_IsTreatedAsAbsent()
    {
        // Whitespace is not an idempotency key; it must not become one.
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);

        var result = await harness.Service.SendAttachmentMessageAsync(
            ConversationId,
            new MessageAttachmentUpload { FileName = "proof.png", ContentType = "image/png", Content = Png() },
            null,
            "   ");

        Assert.True(result.HasAttachment);
        Assert.Null(Assert.Single(harness.Messages.Committed).ClientRequestId);
    }

    [Fact]
    public async Task SendMessage_ClientRequestIdOver450_IsRejected()
    {
        // The text endpoint is protected at the HTTP layer by SendMessageRequestValidator, but
        // the service did not enforce the bound itself. Both send paths now enforce it in the
        // service, so the limit does not depend on a filter having run and the two endpoints
        // cannot drift apart again.
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);

        await Assert.ThrowsAsync<ValidationException>(() =>
            harness.Service.SendMessageAsync(
                ConversationId,
                new SendMessageRequest { Content = "Hello", ClientRequestId = new string('r', 451) }));

        Assert.Empty(harness.Messages.Committed);
    }

    [Fact]
    public async Task SendMessage_ClientRequestIdAt450_IsAccepted()
    {
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);

        var result = await harness.Service.SendMessageAsync(
            ConversationId,
            new SendMessageRequest { Content = "Hello", ClientRequestId = new string('r', 450) });

        Assert.Equal("Hello", result.Content);
    }

    // ======================================================================================
    // Crash 3: a null request body dereferenced straight to a NullReferenceException.
    //
    // ValidateActionFilter skips null arguments, so a JSON body of literal null binds to a null
    // DTO, no validator runs, and ConversationService dereferenced it anyway. The middleware has
    // no NullReferenceException arm, so the caller got a 500.
    // ======================================================================================

    [Fact]
    public async Task SendMessage_NullRequest_IsRejectedNotNullReferenced()
    {
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);

        await Assert.ThrowsAsync<ValidationException>(() =>
            harness.Service.SendMessageAsync(ConversationId, null!));

        Assert.Empty(harness.Messages.Committed);
    }

    // ======================================================================================
    // Crash 4: the single-conversation read disagreed with all five of its siblings.
    //
    // Every other per-conversation entry point treats a soft-deleted hall's thread as gone
    // (404). GET /conversations/{id} checked only "conversation exists", so it answered 200
    // with an empty HallName while still echoing the hall id and both participant ids. It also
    // made the same resource report differently depending on the endpoint used.
    // ======================================================================================

    [Fact]
    public async Task GetConversation_DeletedHall_ThrowsNotFoundLikeEverySibling()
    {
        var deletedHall = new Hall
        {
            Id = HallId,
            Name = "Gone Hall",
            Status = HallStatus.Approved,
            PaymentStatus = HallPaymentStatus.Paid,
            OwnerId = OwnerId,
            IsDeleted = true
        };

        var harness = CreateHarness(
            OwnerId,
            [ApplicationRoles.HallOwner],
            hall: deletedHall,
            conversation: new Conversation
            {
                Id = ConversationId,
                HallId = deletedHall.Id,
                SenderUserId = AdminId,
                HallOwnerId = OwnerId,
                Hall = deletedHall
            });

        await Assert.ThrowsAsync<NotFoundException>(() => harness.Service.GetConversationAsync(ConversationId));
    }

    [Fact]
    public async Task GetConversation_LiveHall_StillReturnsMetadata()
    {
        // The guard must not break the ordinary read, which the Edit 4 carve-out depends on.
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);

        var conversation = await harness.Service.GetConversationAsync(ConversationId);

        Assert.Equal(ConversationId, conversation.ConversationId);
        Assert.Equal(HallId, conversation.HallId);
        Assert.Equal(OwnerId, conversation.OwnerUserId);
    }

    [Fact]
    public async Task GetConversation_DeletedHall_AndTheThread_AgreeOnNotFound()
    {
        // The two read endpoints must not disagree about the same resource.
        var deletedHall = new Hall
        {
            Id = HallId,
            Name = "Gone Hall",
            Status = HallStatus.Approved,
            PaymentStatus = HallPaymentStatus.Paid,
            OwnerId = OwnerId,
            IsDeleted = true
        };

        var harness = CreateHarness(
            OwnerId,
            [ApplicationRoles.HallOwner],
            hall: deletedHall,
            conversation: new Conversation
            {
                Id = ConversationId,
                HallId = deletedHall.Id,
                SenderUserId = AdminId,
                HallOwnerId = OwnerId,
                Hall = deletedHall
            });

        var single = await Record.ExceptionAsync(() => harness.Service.GetConversationAsync(ConversationId));
        var thread = await Record.ExceptionAsync(() => harness.Service.GetConversationThreadAsync(ConversationId));

        Assert.IsType<NotFoundException>(single);
        Assert.IsType<NotFoundException>(thread);
    }

    private sealed class FakeDocumentStorage : IDocumentStorage
    {
        public FakeDocumentStorage(string root) => Root = root;

        public string Root { get; }

        public string OwnerDocumentsDirectory(string ownerId) => Path.Combine(Root, "documents", "owners", ownerId);

        public string ConversationAttachmentsDirectory(Guid conversationId)
            => Path.Combine(Root, "documents", "conversations", conversationId.ToString(), "attachments");
    }

    private sealed class FakeCurrentUserService : ICurrentUserService
    {
        public FakeCurrentUserService(string? userId, IReadOnlyList<string> roles)
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

    private sealed class FakeConversationNotifier : IConversationNotifier
    {
        public Task NotifyMessageSentAsync(MessageSentEvent message, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
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

    private sealed class FakeConversationRepository : IConversationRepository
    {
        private readonly Conversation? _conversation;

        public FakeConversationRepository(Conversation? conversation) => _conversation = conversation;

        /// <summary>Every conversation this repository was asked to persist.</summary>
        public List<Conversation> Added { get; } = [];

        public Task AddAsync(Conversation conversation, CancellationToken cancellationToken = default)
        {
            Added.Add(conversation);
            return Task.CompletedTask;
        }

        public Task<Conversation?> GetByHallAndUserAsync(Guid hallId, string userId, CancellationToken cancellationToken = default)
            => Task.FromResult<Conversation?>(
                _conversation is not null
                && _conversation.HallId == hallId
                && string.Equals(_conversation.SenderUserId, userId, StringComparison.OrdinalIgnoreCase)
                    ? _conversation
                    : null);

        public Task<Conversation?> GetByHallForOwnerAsync(Guid hallId, string ownerId, CancellationToken cancellationToken = default)
            => Task.FromResult<Conversation?>(
                _conversation is not null
                && _conversation.HallId == hallId
                && string.Equals(_conversation.HallOwnerId, ownerId, StringComparison.OrdinalIgnoreCase)
                    ? _conversation
                    : null);

        public Task<Conversation?> GetByIdWithHallAsync(Guid conversationId, CancellationToken cancellationToken = default)
            => Task.FromResult(
                _conversation is not null && _conversation.Id == conversationId ? _conversation : null);

        public Task<IReadOnlyList<Conversation>> GetParticipantConversationsAsync(string userId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Conversation>>(_conversation is null ? [] : [_conversation]);

        public Task<IReadOnlyList<UserDisplayInfo>> GetUserDisplayNamesAsync(IReadOnlyCollection<string> userIds, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<UserDisplayInfo>>(
                userIds
                    .Select(id => new UserDisplayInfo { UserId = id, FullName = $"Display of {id}" })
                    .ToList());

        public Task UpsertReadStateAsync(Guid conversationId, string userId, DateTimeOffset lastReadAt, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task HideConversationAsync(Guid conversationId, string userId, DateTimeOffset hiddenAt, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<int> GetUnreadConversationCountAsync(string userId, bool isAdmin, CancellationToken cancellationToken = default)
            => Task.FromResult(0);

        public Task<Dictionary<Guid, bool>> GetUnreadStatusAsync(string userId, IReadOnlyCollection<Guid> conversationIds, CancellationToken cancellationToken = default)
            => Task.FromResult(new Dictionary<Guid, bool>());
    }

    private sealed class FakeMessageRepository : IMessageRepository
    {
        private readonly List<Message> _pending = [];

        public List<Message> Committed { get; } = [];

        public Task AddAsync(Message message, CancellationToken cancellationToken = default)
        {
            if (message.Id == Guid.Empty)
            {
                message.Id = Guid.NewGuid();
            }

            _pending.Add(message);
            return Task.CompletedTask;
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            Committed.AddRange(_pending);
            _pending.Clear();
            return Task.CompletedTask;
        }

        public Task<Message?> GetByIdAsync(Guid messageId, CancellationToken cancellationToken = default)
            => Task.FromResult(Committed.FirstOrDefault(m => m.Id == messageId));

        public Task<Message?> GetByClientRequestIdAsync(string senderUserId, string clientRequestId, CancellationToken cancellationToken = default)
            => Task.FromResult(Committed.FirstOrDefault(m =>
                m.SenderUserId == senderUserId && m.ClientRequestId == clientRequestId));

        public Task<IReadOnlyList<Message>> GetByConversationAsync(Guid conversationId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Message>>(Committed.Where(m => m.ConversationId == conversationId).ToList());

        public Task<IReadOnlyList<Message>> GetByConversationIdsAsync(IReadOnlyCollection<Guid> conversationIds, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Message>>(Committed.Where(m => conversationIds.Contains(m.ConversationId)).ToList());
    }

    private sealed class FakeHallRepository : IHallRepository
    {
        private readonly Hall? _hall;

        public FakeHallRepository(Hall? hall) => _hall = hall;

        public Task<Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default)
            => Task.FromResult(_hall is not null && _hall.Id == id ? _hall : null);

        public Task<IReadOnlyList<Hall>> GetApprovedHallsAsync(int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>([]);

        public Task<IReadOnlyList<Hall>> GetApprovedHallsByRegionAsync(HallRegion region, int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>([]);

        public Task<IReadOnlyList<Hall>> GetApprovedHallsPaginatedAsync(int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>([]);

        public Task<int> GetApprovedHallsCountAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(0);

        public Task<IReadOnlyList<Hall>> SearchApprovedHallsAsync(string? name, HallRegion? region, string? area, string? detailedAddress, DateOnly? date, TimeOnly? startTime, int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>([]);

        public Task<int> SearchApprovedHallsCountAsync(string? name, HallRegion? region, string? area, string? detailedAddress, DateOnly? date, TimeOnly? startTime, CancellationToken cancellationToken = default)
            => Task.FromResult(0);

        public Task<IReadOnlyList<HallImage>> GetHallImagesAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallImage>>([]);
    }
}
