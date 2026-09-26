using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Documents;

using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// WESAL-TASK-4, Edit 4: the image-attachment message flow that replaces the removed
/// payment-receipt upload. The owner sends subscription-payment proof as an image inside
/// the existing owner/Admin conversation, the Admin reads it back through the protected
/// endpoint, and only then does the Admin flip paid/not-paid explicitly.
/// </summary>
public sealed class ConversationAttachmentMessageShould : IDisposable
{
    private static readonly Guid ConversationId = Guid.NewGuid();
    private static readonly Guid HallId = Guid.NewGuid();
    private const string OwnerId = "owner-1";
    private const string AdminId = "admin-1";

    private readonly string _root;

    public ConversationAttachmentMessageShould()
    {
        _root = Path.Combine(Path.GetTempPath(), "wesal-attach-tests", Guid.NewGuid().ToString("N"));
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

    private static byte[] Jpeg() => [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10];

    private static byte[] Pdf() => [0x25, 0x50, 0x44, 0x46, 0x2D];

    private static MessageAttachmentUpload Upload(
        string fileName = "proof.png",
        string contentType = "image/png",
        byte[]? bytes = null)
        => new()
        {
            FileName = fileName,
            ContentType = contentType,
            Content = bytes ?? Png()
        };

    /// <summary>Posts to the canonical conversation so tests read as one call.</summary>
    private static Task<SendMessageResponse> Send(
        ConversationService service,
        MessageAttachmentUpload upload,
        string? caption = null,
        string? clientRequestId = null)
        => service.SendAttachmentMessageAsync(ConversationId, upload, caption, clientRequestId);

    private sealed class Harness
    {
        public required ConversationService Service { get; init; }
        public required FakeMessageRepository Messages { get; init; }
        public required FakeConversationNotifier Notifier { get; init; }
        public required FakeDocumentStorage Storage { get; init; }
    }

    private Harness CreateHarness(
        string? userId,
        IReadOnlyList<string> roles,
        HallStatus hallStatus = HallStatus.Approved,
        HallPaymentStatus payment = HallPaymentStatus.Paid,
        bool adminLocked = false,
        bool systemLocked = false,
        bool hallDeleted = false,
        string conversationSenderId = AdminId,
        string hallOwnerId = OwnerId,
        string? storageRoot = null)
    {
        var hall = new Hall
        {
            Id = HallId,
            Status = hallStatus,
            PaymentStatus = payment,
            IsAdminLocked = adminLocked,
            SystemLocked = systemLocked,
            IsDeleted = hallDeleted
        };

        var conversationRepository = new FakeConversationRepository(
            new Conversation
            {
                Id = ConversationId,
                HallId = HallId,
                SenderUserId = conversationSenderId,
                HallOwnerId = hallOwnerId,
                Hall = hall
            });

        var messages = new FakeMessageRepository();
        var notifier = new FakeConversationNotifier();
        var storage = new FakeDocumentStorage(storageRoot ?? _root);

        var service = new ConversationService(
            conversationRepository,
            messages,
            new FakeBookingRejectionService(),
            new NoOpBookingAcceptanceService(),
            new FakeHallRepository(),
            new FakeCurrentUserService(userId, roles),
            notifier,
            storage);

        return new Harness
        {
            Service = service,
            Messages = messages,
            Notifier = notifier,
            Storage = storage
        };
    }

    // --- Happy path: the payment-proof image round-trips ---

    [Fact]
    public async Task SendAttachment_OwnerPaid_SendsImageWithCaption()
    {
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);

        var result = await Send(harness.Service, Upload(), "Paid 120 ILS today");

        Assert.True(result.HasAttachment);
        Assert.Equal("Paid 120 ILS today", result.Content);
        Assert.Equal("image/png", result.AttachmentContentType);
        Assert.Equal("proof.png", result.AttachmentFileName);
        Assert.NotNull(result.AttachmentUrl);
    }

    [Fact]
    public async Task SendAttachment_WithoutCaption_SucceedsWithEmptyContent()
    {
        // The owner can send the proof image on its own, with no caption at all.
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);

        var result = await Send(harness.Service, Upload());

        Assert.True(result.HasAttachment);
        Assert.Equal(string.Empty, result.Content);
    }

    [Fact]
    public async Task SendAttachment_WritesFileInsideConversationDirectory()
    {
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);

        var result = await Send(harness.Service, Upload());

        // The response URL is the protected API route; the stored URL is the on-disk
        // location. They are deliberately different, so derive the path from the row.
        Assert.Equal($"/api/v1/conversations/{ConversationId}/messages/{result.MessageId}/attachment", result.AttachmentUrl);

        var stored = Assert.Single(harness.Messages.Committed);
        var expected = Path.Combine(
            harness.Storage.ConversationAttachmentsDirectory(ConversationId),
            Path.GetFileName(stored.AttachmentUrl!));

        Assert.True(File.Exists(expected), $"expected attachment on disk at {expected}");
        Assert.Equal(Png(), await File.ReadAllBytesAsync(expected));
    }

    [Fact]
    public async Task SendAttachment_PersistsMessageAndPushesSignalREvent()
    {
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);

        await Send(harness.Service, Upload());

        var stored = Assert.Single(harness.Messages.Committed);
        Assert.Equal(ConversationId, stored.ConversationId);
        Assert.Equal(OwnerId, stored.SenderUserId);
        Assert.True(stored.HasAttachment);

        var pushed = Assert.Single(harness.Notifier.Sent);
        Assert.True(pushed.HasAttachment);
        Assert.Equal(stored.Id, pushed.MessageId);
        Assert.Equal("image/png", pushed.AttachmentContentType);
        Assert.Equal("proof.png", pushed.AttachmentFileName);
        Assert.NotNull(pushed.AttachmentUrl);
    }

    [Fact]
    public async Task GetAttachment_OwnerParticipant_StreamsStoredImage()
    {
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);
        await Send(harness.Service, Upload());
        var messageId = Assert.Single(harness.Messages.Committed).Id;

        var document = await harness.Service.GetMessageAttachmentAsync(ConversationId, messageId);

        Assert.Equal("image/png", document.ContentType);
        Assert.Equal("proof.png", document.FileName);
        Assert.True(File.Exists(document.FullPath));
        // The stored document exposes the on-disk relative URL, not the API route.
        Assert.Equal(Assert.Single(harness.Messages.Committed).AttachmentUrl, document.RelativeUrl);
    }

    [Fact]
    public async Task GetAttachment_AdminParticipant_CanReadTheProof()
    {
        var owner = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);
        await Send(owner.Service, Upload());
        var messageId = Assert.Single(owner.Messages.Committed).Id;

        // The Admin reviewing the proof reads it through the same protected endpoint.
        var admin = CreateHarness(AdminId, [ApplicationRoles.Admin]);
        admin.Messages.Committed.AddRange(owner.Messages.Committed);

        var document = await admin.Service.GetMessageAttachmentAsync(ConversationId, messageId);

        Assert.True(File.Exists(document.FullPath));
    }

    [Fact]
    public async Task SendAttachment_SeekerSendsImageToTheOwner_AndTheOwnerCanReadItBack()
    {
        // WESAL-TASK-6, Edit 6: attachments are not an owner/Admin-only feature. A seeker who
        // opened a thread from the hall page can send a photo (a venue photo, a question about
        // the hall) and the owner must be able to open it through the same protected endpoint.
        const string SeekerId = "seeker-1";
        var seeker = CreateHarness(SeekerId, [ApplicationRoles.RegisteredUser], conversationSenderId: SeekerId);

        await Send(seeker.Service, Upload("venue.png"));
        var messageId = Assert.Single(seeker.Messages.Committed).Id;

        var owner = CreateHarness(OwnerId, [ApplicationRoles.HallOwner], conversationSenderId: SeekerId);
        owner.Messages.Committed.AddRange(seeker.Messages.Committed);

        var document = await owner.Service.GetMessageAttachmentAsync(ConversationId, messageId);

        Assert.Equal("venue.png", document.FileName);
        Assert.True(File.Exists(document.FullPath));
    }

    [Fact]
    public async Task SendAttachment_SeekerCannotReadAnAttachmentFromSomebodyElsesThread()
    {
        // The same generic path must not widen access: a seeker is a participant of their own
        // thread and nobody else's.
        const string SeekerId = "seeker-1";
        var seeker = CreateHarness(SeekerId, [ApplicationRoles.RegisteredUser], conversationSenderId: SeekerId);
        await Send(seeker.Service, Upload("mine.png"));
        var messageId = Assert.Single(seeker.Messages.Committed).Id;

        var stranger = CreateHarness("seeker-2", [ApplicationRoles.RegisteredUser], conversationSenderId: SeekerId);
        stranger.Messages.Committed.AddRange(seeker.Messages.Committed);

        await Assert.ThrowsAsync<ForbiddenException>(
            () => stranger.Service.GetMessageAttachmentAsync(ConversationId, messageId));
    }

    [Fact]
    public async Task GetAttachment_NonParticipant_ThrowsForbidden()
    {
        var owner = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);
        await Send(owner.Service, Upload());
        var messageId = Assert.Single(owner.Messages.Committed).Id;

        // A signed-in stranger who is neither owner, thread initiator, nor Admin.
        var stranger = CreateHarness("random-user", [ApplicationRoles.RegisteredUser]);
        stranger.Messages.Committed.AddRange(owner.Messages.Committed);

        await Assert.ThrowsAsync<ForbiddenException>(
            () => stranger.Service.GetMessageAttachmentAsync(ConversationId, messageId));
    }

    [Fact]
    public async Task GetAttachment_MessageFromAnotherConversation_ThrowsNotFound()
    {
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);
        await Send(harness.Service, Upload());
        var messageId = Assert.Single(harness.Messages.Committed).Id;

        // Pairing a real message id with a different conversation must not leak the file.
        var otherConversation = Guid.NewGuid();
        var repository = new FakeConversationRepository(
            new Conversation
            {
                Id = otherConversation,
                HallId = HallId,
                SenderUserId = AdminId,
                HallOwnerId = OwnerId,
                Hall = new Hall { Id = HallId }
            });
        var service = new ConversationService(
            repository,
            harness.Messages,
            new FakeBookingRejectionService(),
            new NoOpBookingAcceptanceService(),
            new FakeHallRepository(),
            new FakeCurrentUserService(OwnerId, [ApplicationRoles.HallOwner]),
            new FakeConversationNotifier(),
            harness.Storage);

        await Assert.ThrowsAsync<NotFoundException>(
            () => service.GetMessageAttachmentAsync(otherConversation, messageId));
    }

    [Fact]
    public async Task GetAttachment_TextOnlyMessage_ThrowsNotFound()
    {
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);
        var text = await harness.Service.SendMessageAsync(
            ConversationId, new SendMessageRequest { Content = "Just text" });
        var messageId = Assert.Single(harness.Messages.Committed).Id;

        Assert.False(text.HasAttachment);
        await Assert.ThrowsAsync<NotFoundException>(
            () => harness.Service.GetMessageAttachmentAsync(ConversationId, messageId));
    }

    [Fact]
    public async Task GetAttachment_Unauthenticated_ThrowsUnauthorized()
    {
        var owner = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);
        await Send(owner.Service, Upload());
        var messageId = Assert.Single(owner.Messages.Committed).Id;

        var anonymous = CreateHarness(null, []);
        anonymous.Messages.Committed.AddRange(owner.Messages.Committed);

        await Assert.ThrowsAsync<UnauthorizedException>(
            () => anonymous.Service.GetMessageAttachmentAsync(ConversationId, messageId));
    }

    // --- The payment-proof carve-out: an unpaid owner owns their own payment thread ---

    [Fact]
    public async Task SendAttachment_UnpaidOwner_CanSendPaymentProof()
    {
        // The whole point of Edit 4: the hall is Approved but Unpaid, which normally blocks
        // the owner from messaging. The proof image must still get through.
        var harness = CreateHarness(
            OwnerId, [ApplicationRoles.HallOwner], payment: HallPaymentStatus.Unpaid);

        var result = await Send(harness.Service, Upload());

        Assert.True(result.HasAttachment);
    }

    [Fact]
    public async Task SendTextMessage_UnpaidOwner_CanReplyInOwnPaymentThread()
    {
        // Audit fix: the carve-out was limited to attachments, which left the owner able to
        // upload proof but unable to read the Admin's notice or answer a question about it.
        // The thread is the owner's own, so text is allowed through too.
        var harness = CreateHarness(
            OwnerId, [ApplicationRoles.HallOwner], payment: HallPaymentStatus.Unpaid);

        var result = await harness.Service.SendMessageAsync(
            ConversationId, new SendMessageRequest { Content = "Payment sent, please check." });

        Assert.Equal("Payment sent, please check.", result.Content);
        Assert.False(result.HasAttachment);
    }

    // --- The same carve-out must cover reading, which was the actual dead end ---

    [Fact]
    public async Task GetConversationThread_UnpaidOwner_CanReadPaymentNotice()
    {
        // The regression that motivated the fix: the Admin's payment notice was written into
        // this thread and the owner was then blocked from opening it.
        var harness = CreateHarness(
            OwnerId, [ApplicationRoles.HallOwner], payment: HallPaymentStatus.Unpaid);
        harness.Messages.Committed.Add(new Message
        {
            Id = Guid.NewGuid(),
            ConversationId = ConversationId,
            SenderUserId = AdminId,
            Content = "Please pay the subscription fee and send the receipt image here.",
            CreatedAt = DateTimeOffset.UtcNow
        });

        var thread = await harness.Service.GetConversationThreadAsync(ConversationId);

        Assert.Equal(ConversationId, thread.ConversationId);
        Assert.Contains(thread.Messages, m => m.Content.Contains("send the receipt image"));
    }

    [Fact]
    public async Task GetConversation_UnpaidOwner_CanReadConversationMetadata()
    {
        var harness = CreateHarness(
            OwnerId, [ApplicationRoles.HallOwner], payment: HallPaymentStatus.Unpaid);

        var conversation = await harness.Service.GetConversationAsync(ConversationId);

        Assert.Equal(ConversationId, conversation.ConversationId);
        Assert.Equal(HallId, conversation.HallId);
        Assert.Equal(OwnerId, conversation.OwnerUserId);
    }

    // --- Scope proofs: only the payment requirement is waived, and only for the owner ---

    [Fact]
    public async Task GetConversationThread_UnpaidOwnerAdminLocked_StillBlocked()
    {
        var harness = CreateHarness(
            OwnerId, [ApplicationRoles.HallOwner],
            payment: HallPaymentStatus.Unpaid, adminLocked: true);

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(
            () => harness.Service.GetConversationThreadAsync(ConversationId));

        Assert.Equal(HallManagementAccess.HallLockedCode, ex.Code);
    }

    [Fact]
    public async Task GetConversationThread_UnpaidOwnerSystemLocked_StillBlocked()
    {
        var harness = CreateHarness(
            OwnerId, [ApplicationRoles.HallOwner],
            payment: HallPaymentStatus.Unpaid, systemLocked: true);

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(
            () => harness.Service.GetConversationThreadAsync(ConversationId));

        // PaymentRequired, not HallSystemLocked: HallManagementAccess evaluates payment before
        // the system lock, and the carve-out delegates for any lock.
        Assert.Equal(HallManagementAccess.PaymentRequiredCode, ex.Code);
    }

    [Fact]
    public async Task SendTextMessage_UnpaidOwnerAdminLocked_StillBlocked()
    {
        // The carve-out must not widen the send path past the payment requirement either.
        var harness = CreateHarness(
            OwnerId, [ApplicationRoles.HallOwner],
            payment: HallPaymentStatus.Unpaid, adminLocked: true);

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(
            () => harness.Service.SendMessageAsync(ConversationId, new SendMessageRequest { Content = "Hello" }));

        Assert.Equal(HallManagementAccess.HallLockedCode, ex.Code);
    }

    [Fact]
    public async Task GetConversationThread_SeekerParticipantOnUnpaidHall_UnaffectedByCarveOut()
    {
        // Scope proof. A seeker participant is NOT the hall owner, and the hall-management
        // gate has never applied to them: the carve-out lives strictly below the ownership
        // check, so their access is byte-for-byte the same before and after the change.
        var harness = CreateHarness(
            "seeker-1", [ApplicationRoles.RegisteredUser],
            payment: HallPaymentStatus.Unpaid, conversationSenderId: "seeker-1");

        var thread = await harness.Service.GetConversationThreadAsync(ConversationId);

        Assert.Equal(ConversationId, thread.ConversationId);
    }

    [Fact]
    public async Task GetConversationThread_PaidOwner_ReadsNormally()
    {
        // Sanity: the normal paid path is unchanged.
        var harness = CreateHarness(
            OwnerId, [ApplicationRoles.HallOwner], payment: HallPaymentStatus.Paid);

        var thread = await harness.Service.GetConversationThreadAsync(ConversationId);

        Assert.Equal(ConversationId, thread.ConversationId);
    }

    [Fact]
    public async Task GetConversationThread_Admin_ReadsUnpaidHallThread()
    {
        var harness = CreateHarness(
            AdminId, [ApplicationRoles.Admin], payment: HallPaymentStatus.Unpaid);

        var thread = await harness.Service.GetConversationThreadAsync(ConversationId);

        Assert.Equal(ConversationId, thread.ConversationId);
    }

    [Fact]
    public async Task GetConversationThread_PendingReviewOwner_ReadsNormally()
    {
        // PendingReview was never payment-gated, so the carve-out changes nothing here.
        var harness = CreateHarness(
            OwnerId, [ApplicationRoles.HallOwner],
            hallStatus: HallStatus.PendingReview, payment: HallPaymentStatus.Unpaid);

        var thread = await harness.Service.GetConversationThreadAsync(ConversationId);

        Assert.Equal(ConversationId, thread.ConversationId);
    }

    [Fact]
    public async Task SendAttachment_UnpaidOwnerAdminLocked_StillBlocked()
    {
        var harness = CreateHarness(
            OwnerId, [ApplicationRoles.HallOwner],
            payment: HallPaymentStatus.Unpaid, adminLocked: true);

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(
            () => Send(harness.Service, Upload()));

        Assert.Equal(HallManagementAccess.HallLockedCode, ex.Code);
    }

    [Fact]
    public async Task SendAttachment_UnpaidOwnerSystemLocked_StillBlocked()
    {
        var harness = CreateHarness(
            OwnerId, [ApplicationRoles.HallOwner],
            payment: HallPaymentStatus.Unpaid, systemLocked: true);

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(
            () => Send(harness.Service, Upload()));

        // Still blocked. The code is PaymentRequired rather than HallSystemLocked because
        // HallManagementAccess evaluates the payment requirement before the system lock,
        // so the carve-out (which delegates for any lock) surfaces the payment reason.
        Assert.Equal(HallManagementAccess.PaymentRequiredCode, ex.Code);
    }

    [Fact]
    public async Task SendAttachment_PaidOwnerSystemLocked_ReportsSystemLock()
    {
        // With the payment requirement satisfied, the system lock is the reported reason.
        var harness = CreateHarness(
            OwnerId, [ApplicationRoles.HallOwner],
            payment: HallPaymentStatus.Paid, systemLocked: true);

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(
            () => Send(harness.Service, Upload()));

        Assert.Equal(HallManagementAccess.HallSystemLockedCode, ex.Code);
    }

    [Fact]
    public async Task SendAttachment_PaidOwnerAdminLocked_StillBlocked()
    {
        // A paid owner gains nothing extra from the attachment path.
        var harness = CreateHarness(
            OwnerId, [ApplicationRoles.HallOwner],
            payment: HallPaymentStatus.Paid, adminLocked: true);

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(
            () => Send(harness.Service, Upload()));

        Assert.Equal(HallManagementAccess.HallLockedCode, ex.Code);
    }

    [Fact]
    public async Task SendAttachment_Admin_SucceedsOnUnpaidHallWithoutCarveOut()
    {
        var harness = CreateHarness(AdminId, [ApplicationRoles.Admin], payment: HallPaymentStatus.Unpaid);

        var result = await Send(harness.Service, Upload());

        Assert.True(result.HasAttachment);
    }

    [Fact]
    public async Task SendAttachment_NonParticipant_ThrowsForbidden()
    {
        var harness = CreateHarness("stranger", [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<ForbiddenException>(() => Send(harness.Service, Upload()));
    }

    [Fact]
    public async Task SendAttachment_DeletedHall_ThrowsNotFound()
    {
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner], hallDeleted: true);

        await Assert.ThrowsAsync<NotFoundException>(() => Send(harness.Service, Upload()));
    }

    [Fact]
    public async Task SendAttachment_UnknownConversation_ThrowsNotFound()
    {
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);

        await Assert.ThrowsAsync<NotFoundException>(
            () => harness.Service.SendAttachmentMessageAsync(Guid.NewGuid(), Upload(), null, null));
    }

    [Fact]
    public async Task SendAttachment_Unauthenticated_ThrowsUnauthorized()
    {
        var harness = CreateHarness(null, []);

        await Assert.ThrowsAsync<UnauthorizedException>(() => Send(harness.Service, Upload()));
    }

    // --- Upload validation: image-only, size-capped, signature-checked ---

    [Fact]
    public async Task SendAttachment_RejectsPdfEvenThoughPdfIsAllowedForDocuments()
    {
        // Identity documents may be PDF; a message attachment rendered inline may not.
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);

        await Assert.ThrowsAsync<ValidationException>(
            () => Send(harness.Service, Upload("proof.pdf", "application/pdf", Pdf())));
    }

    [Fact]
    public async Task SendAttachment_RejectsDisguisedExecutableRenamedToPng()
    {
        // Declared image/png but the bytes are a DOS/PE header: the signature check catches it.
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);
        var exe = new byte[] { 0x4D, 0x5A, 0x90, 0x00, 0x03 };

        await Assert.ThrowsAsync<ValidationException>(
            () => Send(harness.Service, Upload("proof.png", "image/png", exe)));
    }

    [Fact]
    public async Task SendAttachment_RejectsExtensionOutsideImageAllowList()
    {
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);

        await Assert.ThrowsAsync<ValidationException>(
            () => Send(harness.Service, Upload("proof.gif", "image/gif", Png())));
    }

    [Fact]
    public async Task SendAttachment_RejectsEmptyFile()
    {
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);

        await Assert.ThrowsAsync<ValidationException>(
            () => Send(harness.Service, Upload("proof.png", "image/png", [])));
    }

    [Fact]
    public async Task SendAttachment_RejectsFileOverFiveMegabytes()
    {
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);
        var oversized = new byte[DocumentUploadValidator.MaxFileSize + 1];
        Png().CopyTo(oversized, 0);

        await Assert.ThrowsAsync<ValidationException>(
            () => Send(harness.Service, Upload("proof.png", "image/png", oversized)));
    }

    [Fact]
    public async Task SendAttachment_RejectsCaptionOver1000Characters()
    {
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);

        await Assert.ThrowsAsync<ValidationException>(
            () => Send(harness.Service, Upload(), new string('x', 1001)));
    }

    [Fact]
    public async Task SendAttachment_RejectsValidationBeforeWritingAnything()
    {
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);

        await Assert.ThrowsAsync<ValidationException>(
            () => Send(harness.Service, Upload("proof.pdf", "application/pdf", Pdf())));

        Assert.Empty(harness.Messages.Committed);
        var directory = harness.Storage.ConversationAttachmentsDirectory(ConversationId);
        Assert.False(Directory.Exists(directory) && Directory.EnumerateFiles(directory).Any());
    }

    [Fact]
    public async Task SendAttachment_JpegProof_IsAccepted()
    {
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);

        var result = await Send(harness.Service, Upload("proof.jpg", "image/jpeg", Jpeg()));

        Assert.Equal("image/jpeg", result.AttachmentContentType);
    }

    [Fact]
    public async Task SendAttachment_StripsPathAndControlCharactersFromDisplayName()
    {
        // The display name is echoed to other participants and returned in a
        // Content-Disposition header, so a client must not be able to persist a path or
        // control characters through it.
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);

        await Send(harness.Service, Upload(fileName: "..\\..\\evil\r\n.png"));

        var stored = Assert.Single(harness.Messages.Committed);
        Assert.Equal("evil.png", stored.AttachmentFileName);
        Assert.DoesNotContain('/', stored.AttachmentFileName!);
        Assert.DoesNotContain('\\', stored.AttachmentFileName!);
        Assert.DoesNotContain('\r', stored.AttachmentFileName!);
        Assert.DoesNotContain('\n', stored.AttachmentFileName!);
    }

    [Fact]
    public async Task SendAttachment_KeepsOrdinaryDisplayNameIntact()
    {
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);

        await Send(harness.Service, Upload(fileName: "Subscription Receipt 2026.png"));

        var stored = Assert.Single(harness.Messages.Committed);
        Assert.Equal("Subscription Receipt 2026.png", stored.AttachmentFileName);
    }

    // --- Idempotency ---

    [Fact]
    public async Task SendAttachment_RepeatedClientRequestId_ReturnsFirstMessageWithoutSecondFile()
    {
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);
        var requestId = Guid.NewGuid().ToString("N");

        var first = await Send(harness.Service, Upload(), null, requestId);
        var second = await Send(harness.Service, Upload(), null, requestId);

        Assert.Equal(first.MessageId, second.MessageId);
        Assert.Single(harness.Messages.Committed);

        var directory = harness.Storage.ConversationAttachmentsDirectory(ConversationId);
        Assert.Single(Directory.EnumerateFiles(directory));
    }

    [Fact]
    public async Task SendAttachment_ClientRequestIdAlreadyUsedForTextMessage_IsRejected()
    {
        // ClientRequestId is unique per sender across all threads, so reusing an id that
        // belongs to a plain text message must not be mistaken for an idempotent replay.
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);
        var requestId = Guid.NewGuid().ToString("N");
        await harness.Service.SendMessageAsync(
            ConversationId, new SendMessageRequest { Content = "First", ClientRequestId = requestId });

        await Assert.ThrowsAsync<ValidationException>(
            () => Send(harness.Service, Upload(), null, requestId));
    }

    [Fact]
    public async Task SendAttachment_DuplicateKeyRace_CleansUpOrphanedFile()
    {
        // A concurrent send with the same ClientRequestId wins; our file copy is removed
        // instead of being orphaned on disk.
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);
        var requestId = Guid.NewGuid().ToString("N");
        harness.Messages.FailNextSaveWithUniqueViolation = true;

        var result = await Send(harness.Service, Upload(), null, requestId);

        // The response is the winner's row, and only the winner's file remains on disk.
        Assert.Equal(Assert.Single(harness.Messages.Committed).Id, result.MessageId);
        var directory = harness.Storage.ConversationAttachmentsDirectory(ConversationId);
        Assert.Empty(Directory.Exists(directory) ? Directory.EnumerateFiles(directory) : []);
    }

    // --- Inbox / thread surfacing ---

    [Fact]
    public async Task GetConversationThread_AttachmentMessage_IsListedWithMetadata()
    {
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);
        var sent = await Send(harness.Service, Upload(), "Proof attached");

        var thread = await harness.Service.GetConversationThreadAsync(ConversationId);

        var message = Assert.Single(thread.Messages);
        Assert.Equal(sent.MessageId, message.Id);
        Assert.True(message.HasAttachment);
        Assert.Equal("Proof attached", message.Content);
        Assert.Equal("image/png", message.AttachmentContentType);
        Assert.Equal("proof.png", message.AttachmentFileName);
    }

    [Fact]
    public async Task GetConversationThread_AttachmentOnlyMessage_HasEmptyContentNotNull()
    {
        var harness = CreateHarness(OwnerId, [ApplicationRoles.HallOwner]);
        await Send(harness.Service, Upload());

        var thread = await harness.Service.GetConversationThreadAsync(ConversationId);

        var message = Assert.Single(thread.Messages);
        Assert.True(message.HasAttachment);
        Assert.Equal(string.Empty, message.Content);
    }

    private sealed class FakeDocumentStorage : IDocumentStorage
    {
        public FakeDocumentStorage(string root) => Root = root;

        public string Root { get; }

        public string OwnerDocumentsDirectory(string ownerId) => Path.Combine(Root, "documents", "owners", ownerId);

    public string ConversationAttachmentsDirectory(Guid conversationId) => Path.Combine(Root, "documents", "conversations", conversationId.ToString(), "attachments");

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

        // Anonymous callers are modelled as a null user id with no roles, which is exactly
        // what the service's EnsureAuthenticated/GetAuthenticatedUserId guards reject.
        public bool IsAuthenticated => _userId is not null;

        public IReadOnlyList<string> Roles { get; }
    }

    private sealed class FakeConversationRepository : IConversationRepository
    {
        private readonly Conversation _conversation;

        public FakeConversationRepository(Conversation conversation) => _conversation = conversation;

        public Task AddAsync(Conversation conversation, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<Conversation?> GetByHallAndUserAsync(Guid hallId, string userId, CancellationToken cancellationToken = default)
            => Task.FromResult<Conversation?>(null);

        public Task<Conversation?> GetByHallForOwnerAsync(Guid hallId, string ownerId, CancellationToken cancellationToken = default)
            => Task.FromResult<Conversation?>(null);

        public Task<Conversation?> GetByIdWithHallAsync(Guid conversationId, CancellationToken cancellationToken = default)
            => Task.FromResult(conversationId == _conversation.Id ? _conversation : null);

        public Task<IReadOnlyList<Conversation>> GetParticipantConversationsAsync(string userId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Conversation>>([_conversation]);

        public Task<IReadOnlyList<UserDisplayInfo>> GetUserDisplayNamesAsync(IReadOnlyCollection<string> userIds, CancellationToken cancellationToken = default)
        {
            var result = userIds
                .Select(id => new UserDisplayInfo { UserId = id, FullName = $"Display of {id}" })
                .ToList();
            return Task.FromResult<IReadOnlyList<UserDisplayInfo>>(result);
        }

        public Task UpsertReadStateAsync(Guid conversationId, string userId, DateTimeOffset lastReadAt, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
        public Task HideConversationAsync(Guid conversationId, string userId, DateTimeOffset hiddenAt, CancellationToken cancellationToken = default)
            => throw new NotImplementedException();

        public Task<int> GetUnreadConversationCountAsync(string userId, CancellationToken cancellationToken = default)
            => Task.FromResult(0);

        public Task<Dictionary<Guid, bool>> GetUnreadStatusAsync(string userId, IReadOnlyCollection<Guid> conversationIds, CancellationToken cancellationToken = default)
            => Task.FromResult(new Dictionary<Guid, bool>());
    }

    private sealed class FakeMessageRepository : IMessageRepository
    {
        private readonly List<Message> _pending = [];

        public List<Message> Committed { get; } = [];

        /// <summary>Simulates losing the insert race on (SenderUserId, ClientRequestId).</summary>
        public bool FailNextSaveWithUniqueViolation { get; set; }

        public Task AddAsync(Message message, CancellationToken cancellationToken = default)
        {
            // The real provider assigns identity on insert, so assign it here too.
            if (message.Id == Guid.Empty)
            {
                message.Id = Guid.NewGuid();
            }

            _pending.Add(message);
            return Task.CompletedTask;
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            if (FailNextSaveWithUniqueViolation)
            {
                FailNextSaveWithUniqueViolation = false;

                // Model the real race: a concurrent request with the same
                // (SenderUserId, ClientRequestId) committed first, so our insert loses.
                var winner = new Message
                {
                    Id = Guid.NewGuid(),
                    ConversationId = ConversationId,
                    SenderUserId = OwnerId,
                    Content = "already sent",
                    AttachmentUrl = $"/documents/conversations/{ConversationId}/attachments/winner.png",
                    AttachmentContentType = "image/png",
                    AttachmentFileName = "winner.png"
                };
                winner.ClientRequestId = _pending[0].ClientRequestId;
                Committed.Add(winner);

                _pending.Clear();
                throw new InvalidOperationException("23505 duplicate key value violates unique constraint");
            }

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
            => Task.FromResult<IReadOnlyList<Message>>(
                Committed.Where(m => m.ConversationId == conversationId)
                    .OrderBy(m => m.CreatedAt)
                    .ThenBy(m => m.Id)
                    .ToList());

        public Task<IReadOnlyList<Message>> GetByConversationIdsAsync(IReadOnlyCollection<Guid> conversationIds, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Message>>(
                Committed.Where(m => conversationIds.Contains(m.ConversationId)).ToList());
    }

    private sealed class FakeConversationNotifier : IConversationNotifier
    {
        public List<MessageSentEvent> Sent { get; } = [];

        public Task NotifyMessageSentAsync(MessageSentEvent message, CancellationToken cancellationToken = default)
        {
            Sent.Add(message);
            return Task.CompletedTask;
        }
    }

    private sealed class FakeBookingRejectionService : IBookingRejectionService
    {
        public Task<RejectBookingResultDto> RejectBookingAsync(Guid hallId, Guid bookingId, RejectBookingRequestDto request, CancellationToken cancellationToken = default)
            => Task.FromResult(new RejectBookingResultDto());

        public Task<int> DeliverPendingRejectionNotificationsAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(0);
    }

    private sealed class FakeHallRepository : IHallRepository
    {
        public Task<Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default)
            => Task.FromResult<Hall?>(null);

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
