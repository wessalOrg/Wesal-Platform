using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Documents;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;
using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// WESAL-TASK-10, Edit 15. The spec asks that "the admin side of the messaging system can
/// receive and manage both regular owner/Admin messages and hall owners'
/// subscription-payment-notice messages, without any missing piece, in the same conversation
/// view".
///
/// Edit 10 moved the hall-messaging gate into one shared rule and applied it to the owner's
/// inbox. That raised the risk this file exists to settle: a rule written to exclude a locked
/// OWNER must not also exclude the ADMIN, who is a legitimate party to the very same thread
/// and the reason the payment notice exists in the first place.
///
/// These run against the real repositories and a real in-memory database rather than hand-
/// fakes, because the behaviour under test is a query filter and the fakes would have
/// re-implemented it.
/// </summary>
public class AdminConversationAccessShould : IDisposable
{
    private const string OwnerId = "owner-1";
    private const string AdminId = "admin-1";
    private const string StrangerId = "stranger-1";

    private readonly ApplicationDbContext _context = CreateContext();

    public void Dispose() => _context.Dispose();

    // ---------------------------------------------------------------------
    // Check 1: the Admin can open the owner/Admin thread and read it in full.
    // ---------------------------------------------------------------------

    [Fact]
    public async Task Admin_CanOpenTheOwnerAdminThread_ForAnApprovedUnpaidHall()
    {
        var seed = SeedOwnerAdminThread(HallPaymentStatus.Unpaid);

        var conversation = await CreateService(AdminId, [ApplicationRoles.Admin])
            .GetConversationAsync(seed.ConversationId);

        Assert.Equal(seed.ConversationId, conversation.ConversationId);
        Assert.Equal(seed.HallId, conversation.HallId);
    }

    [Fact]
    public async Task Admin_CanReadTheFullThread()
    {
        var seed = SeedOwnerAdminThread(HallPaymentStatus.Unpaid);
        SeedMessage(seed.ConversationId, OwnerId, "here is my payment proof");
        SeedMessage(seed.ConversationId, AdminId, "received, we are checking it");

        var thread = await CreateService(AdminId, [ApplicationRoles.Admin])
            .GetConversationThreadAsync(seed.ConversationId);

        Assert.Equal(2, thread.Messages.Count);
        Assert.Contains(thread.Messages, m => m.Content == "here is my payment proof");
    }

    /// <summary>
    /// The payment notice is specifically an image, so "the admin can see the thread" is not
    /// complete until the attachment is readable. That download is the endpoint Edit 10 put
    /// behind the gate, which makes this the check most at risk of the lock fix having gone
    /// too far.
    ///
    /// The proof is sent through the owner's real send path rather than hand-inserted, so the
    /// stored URL matches the convention the download resolves.
    /// </summary>
    [Fact]
    public async Task Admin_CanDownloadTheOwnersPaymentProofAttachment()
    {
        var seed = SeedOwnerAdminThread(HallPaymentStatus.Unpaid);

        var sent = await CreateService(OwnerId, [ApplicationRoles.HallOwner])
            .SendAttachmentMessageAsync(
                seed.ConversationId,
                new MessageAttachmentUpload
                {
                    FileName = "proof.jpg",
                    ContentType = "image/jpeg",
                    Content = [0xFF, 0xD8, 0xFF, 0xE0]
                },
                "payment proof",
                null);

        var document = await CreateService(AdminId, [ApplicationRoles.Admin])
            .GetMessageAttachmentAsync(seed.ConversationId, sent.MessageId);

        Assert.True(File.Exists(document.FullPath));
    }

    [Fact]
    public async Task Admin_CanReadTheThread_WhenTheHallIsAdminLocked()
    {
        var seed = SeedOwnerAdminThread(HallPaymentStatus.Unpaid, isAdminLocked: true);
        SeedMessage(seed.ConversationId, OwnerId, "why was my hall locked?");

        var thread = await CreateService(AdminId, [ApplicationRoles.Admin])
            .GetConversationThreadAsync(seed.ConversationId);

        Assert.Single(thread.Messages);
    }

    [Fact]
    public async Task Admin_CanReadTheThread_WhenTheHallIsSystemLocked()
    {
        var seed = SeedOwnerAdminThread(HallPaymentStatus.Unpaid, isSystemLocked: true);

        var conversation = await CreateService(AdminId, [ApplicationRoles.Admin])
            .GetConversationAsync(seed.ConversationId);

        Assert.Equal(seed.ConversationId, conversation.ConversationId);
    }

    // ---------------------------------------------------------------------
    // Check 2: the Admin can send a regular text reply in that same thread.
    // ---------------------------------------------------------------------

    [Fact]
    public async Task Admin_CanSendATextReply_InAnApprovedUnpaidOwnersThread()
    {
        var seed = SeedOwnerAdminThread(HallPaymentStatus.Unpaid);

        var result = await CreateService(AdminId, [ApplicationRoles.Admin]).SendMessageAsync(
            seed.ConversationId,
            new SendMessageRequest { Content = "please resend at higher resolution" });

        Assert.Equal("please resend at higher resolution", result.Content);
        Assert.Equal(AdminId, result.SenderUserId);
    }

    /// <summary>
    /// The reverse direction of Edit 10's fix: a locked owner cannot post, but the Admin must
    /// still be able to start the exchange, because the lock is frequently the very thing the
    /// two sides need to discuss.
    /// </summary>
    [Fact]
    public async Task Admin_CanReply_WhenTheHallIsAdminLocked()
    {
        var seed = SeedOwnerAdminThread(HallPaymentStatus.Unpaid, isAdminLocked: true);

        var result = await CreateService(AdminId, [ApplicationRoles.Admin]).SendMessageAsync(
            seed.ConversationId,
            new SendMessageRequest { Content = "about your lock" });

        Assert.Equal("about your lock", result.Content);
    }

    [Fact]
    public async Task Admin_CanReply_WhenTheHallIsSystemLocked()
    {
        var seed = SeedOwnerAdminThread(HallPaymentStatus.Unpaid, isSystemLocked: true);

        var result = await CreateService(AdminId, [ApplicationRoles.Admin]).SendMessageAsync(
            seed.ConversationId,
            new SendMessageRequest { Content = "your subscription expired" });

        Assert.Equal("your subscription expired", result.Content);
    }

    [Fact]
    public async Task Admin_CanMarkTheThreadRead()
    {
        var seed = SeedOwnerAdminThread(HallPaymentStatus.Unpaid);

        await CreateService(AdminId, [ApplicationRoles.Admin]).MarkAsReadAsync(seed.ConversationId);

        Assert.Contains(
            _context.ConversationReadStates,
            s => s.ConversationId == seed.ConversationId && s.UserId == AdminId);
    }

    // ---------------------------------------------------------------------
    // Check 3: the Admin's OWN inbox still lists the thread. This is the check
    // Edit 10's inbox gate could most plausibly have broken.
    // ---------------------------------------------------------------------

    [Fact]
    public async Task AdminsInbox_StillListsTheOwnerAdminThread_WhenTheOwnerIsUnpaid()
    {
        var seed = SeedOwnerAdminThread(HallPaymentStatus.Unpaid);

        var inbox = await CreateService(AdminId, [ApplicationRoles.Admin]).GetMyConversationsAsync();

        Assert.Contains(inbox, c => c.ConversationId == seed.ConversationId);
    }

    [Fact]
    public async Task AdminsInbox_StillListsTheOwnerAdminThread_WhenTheHallIsAdminLocked()
    {
        var seed = SeedOwnerAdminThread(HallPaymentStatus.Unpaid, isAdminLocked: true);

        var inbox = await CreateService(AdminId, [ApplicationRoles.Admin]).GetMyConversationsAsync();

        Assert.Contains(inbox, c => c.ConversationId == seed.ConversationId);
    }

    [Fact]
    public async Task AdminsInbox_StillListsTheOwnerAdminThread_WhenTheHallIsSystemLocked()
    {
        var seed = SeedOwnerAdminThread(HallPaymentStatus.Unpaid, isSystemLocked: true);

        var inbox = await CreateService(AdminId, [ApplicationRoles.Admin]).GetMyConversationsAsync();

        Assert.Contains(inbox, c => c.ConversationId == seed.ConversationId);
    }

    /// <summary>
    /// A second Admin who appears in neither the SenderUserId nor the HallOwnerId column. The
    /// gate keys on the caller's ROLE, not on which column holds their id, so this must not
    /// matter — but it is exactly the shape that would break if the gate had been written
    /// against the two-party columns instead of the role.
    /// </summary>
    [Fact]
    public async Task ASecondAdmin_NotInEitherThreadColumn_CanStillReadTheThread()
    {
        var seed = SeedOwnerAdminThread(HallPaymentStatus.Unpaid);

        var conversation = await CreateService("admin-2", [ApplicationRoles.Admin])
            .GetConversationAsync(seed.ConversationId);

        Assert.Equal(seed.ConversationId, conversation.ConversationId);
    }

    /// <summary>
    /// The one case where the two sides genuinely differ, and the reason the inbox gate had to
    /// exist: the OWNER of a locked hall must NOT see the row, because the row previews the
    /// newest message's content. Kept next to the admin assertions so the pair stays honest —
    /// if this ever starts failing, the admin ones above may be passing for the wrong reason.
    /// </summary>
    [Fact]
    public async Task OwnersInbox_ExcludesTheRow_WhenTheHallIsAdminLocked()
    {
        var seed = SeedOwnerAdminThread(HallPaymentStatus.Unpaid, isAdminLocked: true);

        var inbox = await CreateService(OwnerId, [ApplicationRoles.HallOwner]).GetMyConversationsAsync();

        Assert.DoesNotContain(inbox, c => c.ConversationId == seed.ConversationId);
    }

    /// <summary>
    /// The owner's side of the same carve-out Edit 4 established: unpaid but not locked keeps
    /// the row, because that is the thread the payment notice lives in.
    /// </summary>
    [Fact]
    public async Task OwnersInbox_KeepsTheRow_WhenTheHallIsUnpaidButUnlocked()
    {
        var seed = SeedOwnerAdminThread(HallPaymentStatus.Unpaid);

        var inbox = await CreateService(OwnerId, [ApplicationRoles.HallOwner]).GetMyConversationsAsync();

        Assert.Contains(inbox, c => c.ConversationId == seed.ConversationId);
    }

    // ---------------------------------------------------------------------
    // Check 4: no artificial distinction between the two kinds of thread.
    // ---------------------------------------------------------------------

    /// <summary>
    /// Edit 11 made "Contact Admin" general-purpose, so a payment-notice thread and a general
    /// enquiry share one deterministic key, (HallId, HallOwnerId). They are the SAME
    /// conversation, which is what lets an admin review the proof and the surrounding
    /// discussion in one view rather than hunting across two lists.
    /// </summary>
    [Fact]
    public async Task APaymentNoticeThreadAndAGeneralEnquiryResolveToTheSameSingleThread()
    {
        var seed = SeedOwnerAdminThread(HallPaymentStatus.Unpaid);

        var contactAdmin = await CreateService(OwnerId, [ApplicationRoles.HallOwner])
            .ContactAdminAsync(seed.HallId);

        Assert.Equal(seed.ConversationId, contactAdmin.ConversationId);
        Assert.True(contactAdmin.IsExisting);
        Assert.Single(_context.Conversations);
    }

    // ---------------------------------------------------------------------
    // Check 5: the Admin can act on the hall without losing the thread context.
    // ---------------------------------------------------------------------

    [Fact]
    public async Task TheThreadResponseCarriesTheHallContextTheAdminNeedsToAct()
    {
        var seed = SeedOwnerAdminThread(HallPaymentStatus.Unpaid, hallName: "Al-Rashid Wedding Hall");

        var thread = await CreateService(AdminId, [ApplicationRoles.Admin])
            .GetConversationThreadAsync(seed.ConversationId);

        Assert.Equal(seed.HallId, thread.HallId);
        Assert.Equal("Al-Rashid Wedding Hall", thread.HallName);
    }

    [Fact]
    public async Task TheConversationResponseCarriesTheHallContextTheAdminNeedsToAct()
    {
        var seed = SeedOwnerAdminThread(HallPaymentStatus.Unpaid, hallName: "Al-Rashid Wedding Hall");

        var conversation = await CreateService(AdminId, [ApplicationRoles.Admin])
            .GetConversationAsync(seed.ConversationId);

        Assert.Equal(seed.HallId, conversation.HallId);
        Assert.Equal("Al-Rashid Wedding Hall", conversation.HallName);
    }

    // ---------------------------------------------------------------------
    // Non-admins must be unaffected by anything in this file.
    // ---------------------------------------------------------------------

    [Fact]
    public async Task ANonAdminThirdParty_CannotReadTheThread()
    {
        var seed = SeedOwnerAdminThread(HallPaymentStatus.Unpaid);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            CreateService(StrangerId, [ApplicationRoles.RegisteredUser])
                .GetConversationThreadAsync(seed.ConversationId));
    }

    [Fact]
    public async Task ANonAdminThirdParty_CannotSendIntoTheThread()
    {
        var seed = SeedOwnerAdminThread(HallPaymentStatus.Unpaid);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            CreateService(StrangerId, [ApplicationRoles.RegisteredUser])
                .SendMessageAsync(seed.ConversationId, new SendMessageRequest { Content = "hello" }));
    }

    // ---------------------------------------------------------------------

    private sealed record Seed(Guid HallId, Guid ConversationId);

    private Seed SeedOwnerAdminThread(
        HallPaymentStatus paymentStatus,
        bool isAdminLocked = false,
        bool isSystemLocked = false,
        string hallName = "Test Hall")
    {
        var hall = new Hall
        {
            Id = Guid.NewGuid(),
            Name = hallName,
            Address = "Al-Rashid Street, Gaza",
            Region = HallRegion.Gaza,
            Capacity = 200,
            Price = 1500,
            ShowPrice = true,
            ContactPhone = "+970599111111",
            Description = "Spacious hall",
            OwnerId = OwnerId,
            Status = HallStatus.Approved,
            PaymentStatus = paymentStatus,
            IsAdminLocked = isAdminLocked,
            SystemLocked = isSystemLocked
        };

        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            SenderUserId = AdminId,
            HallOwnerId = OwnerId,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _context.Halls.Add(hall);
        _context.Conversations.Add(conversation);
        _context.SaveChanges();

        return new Seed(hall.Id, conversation.Id);
    }

    private void SeedMessage(Guid conversationId, string sender, string content)
    {
        _context.Messages.Add(new Message
        {
            Id = Guid.NewGuid(),
            ConversationId = conversationId,
            SenderUserId = sender,
            Content = content,
            CreatedAt = DateTimeOffset.UtcNow
        });
        _context.SaveChanges();
    }

    private Guid SeedAttachmentMessage(Guid conversationId, string sender, string content)
    {
        var message = new Message
        {
            Id = Guid.NewGuid(),
            ConversationId = conversationId,
            SenderUserId = sender,
            Content = content,
            AttachmentUrl = DocumentPath.MessageAttachmentRelativeUrl(conversationId, "proof.jpg"),
            AttachmentFileName = "proof.jpg",
            AttachmentContentType = "image/jpeg",
            CreatedAt = DateTimeOffset.UtcNow
        };

        _context.Messages.Add(message);
        _context.SaveChanges();
        return message.Id;
    }

    private ConversationService CreateService(string userId, IReadOnlyList<string> roles)
        => new(
            new ConversationRepository(_context),
            new MessageRepository(_context),
            new FakeBookingRejectionService(),
            new NoOpBookingAcceptanceService(),
            new HallRepository(_context),
            new FakeCurrentUserService(userId, roles),
            new RecordingConversationNotifier(),
            new TempDocumentStorage());

    private sealed class FakeBookingRejectionService : IBookingRejectionService
    {
        public Task<RejectBookingResultDto> RejectBookingAsync(
            Guid hallId, Guid bookingId, RejectBookingRequestDto request, CancellationToken cancellationToken = default)
            => Task.FromResult(new RejectBookingResultDto());

        public Task<int> DeliverPendingRejectionNotificationsAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(0);
    }

    private static ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new ApplicationDbContext(options);
    }

    private sealed class FakeCurrentUserService : ICurrentUserService
    {
        private readonly string? _userId;

        public FakeCurrentUserService(string? userId, IReadOnlyList<string> roles)
        {
            _userId = userId;
            Roles = roles;
        }

        public string? UserId => _userId;

        public string? UserName => "test";

        public string? Email => "test@example.com";

        public bool IsAuthenticated => _userId is not null;

        public IReadOnlyList<string> Roles { get; }
    }

    private sealed class TempDocumentStorage : IDocumentStorage
    {
        public string Root { get; } = Path.Combine(Path.GetTempPath(), "wesal-edit15-storage");

        public string OwnerDocumentsDirectory(string ownerId)
            => Path.Combine(Root, "documents", "owners", ownerId);

        public string ConversationAttachmentsDirectory(Guid conversationId)
            => Path.Combine(Root, "documents", "conversations", conversationId.ToString(), "attachments");
    }
}
