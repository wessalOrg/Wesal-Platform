using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Documents;

namespace Wesal.Infrastructure.Conversations;

public sealed class ConversationService : IConversationService
{
    private readonly IConversationRepository _conversationRepository;
    private readonly IMessageRepository _messageRepository;
    private readonly IBookingRejectionService _bookingRejectionService;
    private readonly IBookingAcceptanceService _bookingAcceptanceService;
    private readonly IHallRepository _hallRepository;
    private readonly ICurrentUserService _currentUser;
    private readonly IConversationNotifier _notifier;
    private readonly IDocumentStorage _documentStorage;

    public ConversationService(
        IConversationRepository conversationRepository,
        IMessageRepository messageRepository,
        IBookingRejectionService bookingRejectionService,
        IBookingAcceptanceService bookingAcceptanceService,
        IHallRepository hallRepository,
        ICurrentUserService currentUser,
        IConversationNotifier notifier,
        IDocumentStorage documentStorage)
    {
        _conversationRepository = conversationRepository;
        _messageRepository = messageRepository;
        _bookingRejectionService = bookingRejectionService;
        _bookingAcceptanceService = bookingAcceptanceService;
        _hallRepository = hallRepository;
        _currentUser = currentUser;
        _notifier = notifier;
        _documentStorage = documentStorage;
    }

    public async Task<ConversationResponse> CreateConversationAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        EnsureAuthenticated();
        EnsureRegisteredUserOrHallOwner();

        var hall = await _hallRepository.GetHallByIdAsync(hallId, cancellationToken);

        if (hall is null || hall.IsDeleted || hall.Status != HallStatus.Approved)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        EnsureNotSelfContact(hall);

        // WESAL-TASK-10 (Edit 10): Hall.OwnerId is nullable but Conversation.HallOwnerId maps to
        // a NOT NULL column. The null-forgiving "!" only silenced the compiler, so an approved
        // hall with no owner produced a row the database refuses, surfacing as an unhandled
        // 500. Guard it the same way BookingRejectionService, BookingAcceptanceService and
        // AdminHallReviewService already do. Without an owner there is nobody to talk to, so
        // the hall is simply not contactable.
        if (string.IsNullOrWhiteSpace(hall.OwnerId))
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        var senderUserId = _currentUser.UserId!;

        var existing = await _conversationRepository.GetByHallAndUserAsync(hallId, senderUserId, cancellationToken);

        if (existing is not null)
        {
            return MapToResponse(existing, hall.Name, isExisting: true);
        }

        var conversation = new Conversation
        {
            HallId = hallId,
            SenderUserId = senderUserId,
            HallOwnerId = hall.OwnerId!
        };

        await _conversationRepository.AddAsync(conversation, cancellationToken);

        return MapToResponse(conversation, hall.Name, isExisting: false);
    }

    /// <inheritdoc />
    public async Task<ConversationResponse> ContactAdminAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        EnsureAuthenticated();
        EnsureRegisteredUserOrHallOwner();

        var hall = await _hallRepository.GetHallByIdAsync(hallId, cancellationToken);

        if (hall is null || hall.IsDeleted)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        var ownerId = _currentUser.UserId!;

        // Edit 11: only the owner of THIS hall may open its owner/Admin thread. Without
        // this any authenticated user could mint an owner/Admin thread for a hall they do
        // not own and then post into it. This stays AHEAD of the lock check below on
        // purpose: ownership is an authorization question and must be settled first,
        // otherwise a stranger could probe a hall's lock state by calling this action.
        if (!string.Equals(ownerId, hall.OwnerId, StringComparison.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Only the hall owner can open the conversation with the platform support.");
        }

        // WESAL-TASK-10 (Edit 10 follow-up): the lock this interface has always documented
        // ("A locked hall is still refused") was never enforced here, so a locked owner
        // could still open the owner/Admin thread — the same partial lock as the attachment
        // download. Delegated to the shared gate with isThreadOwner: true, because by this
        // point the caller is verified as THIS hall's owner. Edit 4's unpaid carve-out
        // therefore still lets an Approved-but-unpaid, unlocked owner reach the Admin, which
        // is what that carve-out is for.
        ConversationAccess.EnsureOwnerMessagingAccess(
            hall,
            isThreadOwner: true,
            isAdmin: _currentUser.Roles.Contains(ApplicationRoles.Admin, StringComparer.OrdinalIgnoreCase));

        // Edit 4's deterministic (HallId, HallOwnerId) resolution, reused verbatim so a
        // "Contact Admin" click can never fork a second thread away from the one the
        // payment notice and every other Admin message already use.
        var existing = await _conversationRepository.GetByHallForOwnerAsync(hallId, ownerId, cancellationToken);

        if (existing is not null)
        {
            return MapToResponse(existing, hall.Name, isExisting: true);
        }

        // No Admin is logged in on the owner's side, yet the new thread still has to land
        // in a real Admin's conversation list, so resolve a stable Admin id for the
        // counterparty slot. Falls back to the platform's Admin-side sentinel, which the
        // shared Admin inbox (Edit 16) still recognises as Admin-side.
        var adminUserId = await _conversationRepository.GetAdminUserIdAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(adminUserId))
        {
            adminUserId = PlatformSenders.AdminFallback;
        }

        var conversation = new Conversation
        {
            HallId = hallId,
            SenderUserId = adminUserId,
            HallOwnerId = ownerId
        };

        await _conversationRepository.AddAsync(conversation, cancellationToken);

        return MapToResponse(conversation, hall.Name, isExisting: false);
    }

    public async Task<ConversationResponse> GetConversationAsync(
        Guid conversationId,
        CancellationToken cancellationToken = default)    {
        cancellationToken.ThrowIfCancellationRequested();

        EnsureAuthenticated();

        var conversation = await _conversationRepository.GetByIdWithHallAsync(conversationId, cancellationToken);

        // WESAL-TASK-10 (Edit 10): every sibling per-conversation path treats a soft-deleted
        // hall's thread as gone. This one checked only that the conversation existed, so it
        // answered 200 with an empty HallName while still echoing the hall id and both
        // participant ids, and the same resource reported differently depending on which
        // endpoint was used. EnsureOwnerMessagingAccess cannot compensate: it deliberately
        // allows deleted halls, so the gate has to be here.
        if (conversation is null || conversation.Hall?.IsDeleted == true)
        {
            throw new NotFoundException(nameof(Conversation), conversationId);
        }

        var userId = _currentUser.UserId!;
        var isParticipant = string.Equals(userId, conversation.SenderUserId, StringComparison.OrdinalIgnoreCase)
            || string.Equals(userId, conversation.HallOwnerId, StringComparison.OrdinalIgnoreCase)
            || _currentUser.Roles.Contains(ApplicationRoles.Admin, StringComparer.OrdinalIgnoreCase);

        if (!isParticipant)
        {
            throw new ForbiddenException("You do not have access to this conversation.");
        }

        EnsureOwnerMessagingAccess(conversation);

        return MapToResponse(conversation, conversation.Hall?.Name ?? string.Empty, isExisting: true);
    }

    public async Task<IReadOnlyList<ConversationSummaryResponse>> GetMyConversationsAsync(
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var userId = GetAuthenticatedUserId();

        await DeliverPendingBookingNotificationsAsync(cancellationToken);

        // WESAL-TASK-10, Edit 16: resolved once, up front, and handed to every query that has
        // to agree on it — the list, the per-row unread flags and the displayed counterparty.
        // Two of them consulting the role table separately could drift, and the whole point of
        // a shared inbox is that they are describing the same audience.
        var isAdmin = _currentUser.Roles.Contains(ApplicationRoles.Admin, StringComparer.OrdinalIgnoreCase);

        // Empty for a seeker or an owner, which is what keeps their query on the two-party
        // rule that has always applied to them.
        var adminUserIds = isAdmin
            ? await _conversationRepository.GetAdminUserIdsAsync(cancellationToken)
            : [];

        var conversations = await _conversationRepository.GetParticipantConversationsAsync(
            userId, isAdmin, adminUserIds, cancellationToken);

        if (conversations.Count == 0)
        {
            return [];
        }

        // WESAL-TASK-10, Edit 14: the inbox was the one conversation surface that never ran
        // the hall-messaging gate. A locked owner was refused the thread, its messages, its
        // read receipt and both send paths, and was still handed this row: hall name, the
        // other party, the newest message's CONTENT, its attachment flag, the message count
        // and an unread badge. The gate was enforced everywhere except the endpoint that
        // previews the thread, which is a bypass of it rather than a cosmetic gap.
        //
        // The row is dropped, not blanked. A row with the content removed would still report
        // that a thread exists, who it is with, how many messages it holds and when it was
        // last active, and an unopenable row is not something a client can render. Dropping
        // it also keeps this list and the unread badge in step: the badge is filtered by the
        // same rule (see GetUnreadConversationCountAsync), so the count of unread rows a user
        // can see always equals the badge.
        //
        // isAdmin and the Admin audience are already resolved above (Edit 16), so this filter
        // stays the same single gate it has been. Seekers and Admins are unaffected, and Edit
        // 4's unpaid carve-out is untouched, so an Approved-but-unpaid owner keeps the row
        // that shows them their payment thread.
        conversations = conversations
            .Where(conversation => ConversationAccess.CanAccess(
                conversation.Hall,
                isThreadOwner: string.Equals(userId, conversation.HallOwnerId, StringComparison.OrdinalIgnoreCase),
                isAdmin: isAdmin))
            .ToList();

        if (conversations.Count == 0)
        {
            return [];
        }

        var conversationIds = conversations.Select(conversation => conversation.Id).ToList();

        var messages = await _messageRepository.GetByConversationIdsAsync(conversationIds, cancellationToken);

        var latestByConversation = messages
            .GroupBy(message => message.ConversationId)
            .ToDictionary(
                group => group.Key,
                group => group.OrderBy(message => message.CreatedAt).ThenBy(message => message.Id).Last());

        var messageCounts = messages
            .GroupBy(message => message.ConversationId)
            .ToDictionary(group => group.Key, group => group.Count());

        var otherParticipantIds = conversations
            .Select(conversation => OtherParticipantId(conversation, userId, isAdmin, adminUserIds))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var nameLookup = (await _conversationRepository.GetUserDisplayNamesAsync(otherParticipantIds, cancellationToken))
            .ToDictionary(info => info.UserId, info => info.FullName, StringComparer.OrdinalIgnoreCase);

        // WESAL-TASK-10 (Edit 10 follow-up): IsUnread was declared on the response and never
        // assigned, so every row reported not-unread. The repository already computed exactly
        // this (GetUnreadStatusAsync had no callers at all), and it now uses the same rule as
        // the unread-count badge, so the per-row flag and the badge cannot disagree.
        var unreadStatus = await _conversationRepository.GetUnreadStatusAsync(
            userId, isAdmin, adminUserIds, conversationIds, cancellationToken);

        return conversations
            .OrderByDescending(conversation => latestByConversation.GetValueOrDefault(conversation.Id)?.CreatedAt ?? conversation.CreatedAt)
            .ThenByDescending(conversation => conversation.Id)
            .Select(conversation =>
            {
                var latest = latestByConversation.GetValueOrDefault(conversation.Id);
                var otherParticipantId = OtherParticipantId(conversation, userId, isAdmin, adminUserIds);

                return new ConversationSummaryResponse
                {
                    ConversationId = conversation.Id,
                    HallId = conversation.HallId,
                    HallName = conversation.Hall?.Name ?? string.Empty,
                    OtherParticipantId = otherParticipantId,
                    OtherParticipantName = nameLookup.GetValueOrDefault(otherParticipantId) ?? string.Empty,
                    LastMessagePreview = latest?.Content ?? string.Empty,
                    LastMessageHasAttachment = latest?.HasAttachment ?? false,
                    LastMessageAt = latest?.CreatedAt,
                    MessageCount = messageCounts.GetValueOrDefault(conversation.Id),
                    CreatedAt = conversation.CreatedAt,
                    IsUnread = unreadStatus.GetValueOrDefault(conversation.Id)
                };
            })
            .ToList();
    }

    public async Task<MessageThreadResponse> GetConversationThreadAsync(
        Guid conversationId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var userId = GetAuthenticatedUserId();

        await DeliverPendingBookingNotificationsAsync(cancellationToken);

        var conversation = await _conversationRepository.GetByIdWithHallAsync(conversationId, cancellationToken);

        if (conversation is null || conversation.Hall?.IsDeleted == true)
        {
            throw new NotFoundException(nameof(Conversation), conversationId);
        }

        var isParticipant = string.Equals(userId, conversation.SenderUserId, StringComparison.OrdinalIgnoreCase)
            || string.Equals(userId, conversation.HallOwnerId, StringComparison.OrdinalIgnoreCase)
            || _currentUser.Roles.Contains(ApplicationRoles.Admin, StringComparer.OrdinalIgnoreCase);

        if (!isParticipant)
        {
            throw new ForbiddenException("You do not have access to this conversation.");
        }

        EnsureOwnerMessagingAccess(conversation);

        var messages = await _messageRepository.GetByConversationAsync(conversationId, cancellationToken);

        var senderIds = messages
            .Select(message => message.SenderUserId)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var senderNames = (await _conversationRepository.GetUserDisplayNamesAsync(senderIds, cancellationToken))
            .ToDictionary(info => info.UserId, info => info.FullName, StringComparer.OrdinalIgnoreCase);

        return new MessageThreadResponse
        {
            ConversationId = conversation.Id,
            HallId = conversation.HallId,
            HallName = conversation.Hall?.Name ?? string.Empty,
            Messages = messages
                .Select(message => new MessageDto
                {
                    Id = message.Id,
                    SenderUserId = message.SenderUserId,
                    SenderName = senderNames.GetValueOrDefault(message.SenderUserId) ?? string.Empty,
                    Content = message.Content ?? string.Empty,
                    SentAt = message.CreatedAt,
                    HasAttachment = message.HasAttachment,
                    AttachmentUrl = message.HasAttachment
                        ? $"/api/v1/conversations/{conversationId}/messages/{message.Id}/attachment"
                        : null,
                    AttachmentContentType = message.AttachmentContentType,
                    AttachmentFileName = message.AttachmentFileName
                })
                .ToList()
        };
    }

    public async Task<SendMessageResponse> SendMessageAsync(
        Guid conversationId,
        SendMessageRequest request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        EnsureAuthenticated();

        // WESAL-TASK-10 (Edit 10): a JSON body of literal null binds to a null DTO, and
        // ValidateActionFilter skips null arguments, so no validator runs. Dereferencing it
        // anyway threw a NullReferenceException, which the middleware has no arm for, so the
        // caller got a 500 for a malformed request.
        if (request is null)
        {
            throw new ValidationException("A message body is required.");
        }

        ValidateMessageContent(request.Content);
        ValidateClientRequestId(request.ClientRequestId);

        var conversation = await _conversationRepository.GetByIdWithHallAsync(conversationId, cancellationToken);

        if (conversation is null || conversation.Hall?.IsDeleted == true)
        {
            throw new NotFoundException(nameof(Conversation), conversationId);
        }

        var senderUserId = _currentUser.UserId!;

        var isParticipant = string.Equals(senderUserId, conversation.SenderUserId, StringComparison.OrdinalIgnoreCase)
            || string.Equals(senderUserId, conversation.HallOwnerId, StringComparison.OrdinalIgnoreCase)
            || _currentUser.Roles.Contains(ApplicationRoles.Admin, StringComparer.OrdinalIgnoreCase);

        if (!isParticipant)
        {
            throw new ForbiddenException("You do not have access to this conversation.");
        }

        EnsureOwnerMessagingAccess(conversation);

        if (!string.IsNullOrWhiteSpace(request.ClientRequestId))
        {
            var existing = await _messageRepository.GetByClientRequestIdAsync(
                senderUserId, request.ClientRequestId, cancellationToken);

            if (existing is not null)
            {
                var senderName = await ResolveSenderNameAsync(senderUserId, cancellationToken);
                return MapToSendMessageResponse(existing, conversationId, senderName, isDuplicate: true);
            }
        }

        var message = new Message
        {
            ConversationId = conversationId,
            SenderUserId = senderUserId,
            Content = request.Content.Trim(),
            ClientRequestId = string.IsNullOrWhiteSpace(request.ClientRequestId)
                ? null
                : request.ClientRequestId
        };

        await _messageRepository.AddAsync(message, cancellationToken);

        try
        {
            await _messageRepository.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex) when (IsUniqueViolation(ex) && !string.IsNullOrWhiteSpace(request.ClientRequestId))
        {
            var duplicate = await _messageRepository.GetByClientRequestIdAsync(
                senderUserId, request.ClientRequestId, cancellationToken);

            if (duplicate is not null)
            {
                var senderName = await ResolveSenderNameAsync(senderUserId, cancellationToken);
                return MapToSendMessageResponse(duplicate, conversationId, senderName, isDuplicate: true);
            }

            throw;
        }

        var resolvedSenderName = await ResolveSenderNameAsync(senderUserId, cancellationToken);

        await NotifyMessageSentAsync(conversationId, message, resolvedSenderName, cancellationToken);

        return MapToSendMessageResponse(message, conversationId, resolvedSenderName);
    }

    /// <summary>
    /// Posts a message carrying an image attachment (WESAL-TASK-4, Edit 4). This is the
    /// channel an owner uses to send subscription-payment proof to the Admins inside the
    /// same owner/Admin thread, so it deliberately reuses every existing guard: same
    /// conversation lookup, same participant check, same owner messaging gate (with the
    /// documented payment-proof carve-out), same ClientRequestId de-duplication and the
    /// same SignalR push.
    /// </summary>
    public async Task<SendMessageResponse> SendAttachmentMessageAsync(
        Guid conversationId,
        MessageAttachmentUpload attachment,
        string? content,
        string? clientRequestId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        EnsureAuthenticated();

        var caption = content?.Trim();
        if (string.IsNullOrEmpty(caption))
        {
            caption = null;
        }
        else if (caption.Length > 1000)
        {
            throw new ValidationException("Message content must not exceed 1000 characters.");
        }

        DocumentUploadValidator.EnsureValidImage(new OwnerDocumentUpload
        {
            FileName = attachment.FileName,
            ContentType = attachment.ContentType,
            Content = attachment.Content
        });

        var conversation = await _conversationRepository.GetByIdWithHallAsync(conversationId, cancellationToken);

        if (conversation is null || conversation.Hall?.IsDeleted == true)
        {
            throw new NotFoundException(nameof(Conversation), conversationId);
        }

        var senderUserId = _currentUser.UserId!;

        EnsureParticipant(conversation, senderUserId);

        // The attachment is the subscription-payment proof the Admin asked for, so this is
        // the call that motivated the unpaid carve-out in EnsureOwnerMessagingAccess.
        EnsureOwnerMessagingAccess(conversation);

        var normalizedRequestId = string.IsNullOrWhiteSpace(clientRequestId) ? null : clientRequestId;

        // WESAL-TASK-10 (Edit 10): bound the key before it is used or written. This arrives as
        // a raw form field, so unlike the text path no validator ever saw it, and an over-long
        // value produced an unhandled database error at the insert.
        ValidateClientRequestId(normalizedRequestId);

        if (normalizedRequestId is not null)
        {
            var existing = await _messageRepository.GetByClientRequestIdAsync(
                senderUserId, normalizedRequestId, cancellationToken);

            if (existing is not null)
            {
                // Only an idempotent replay of THIS send is a no-op. A ClientRequestId is
                // scoped to one sender across all their threads, so reusing an id that
                // belongs to a different conversation (or to a plain text message) must not
                // silently return that unrelated row as if the image had been sent.
                if (existing.ConversationId == conversationId && existing.HasAttachment)
                {
                    var existingSenderName = await ResolveSenderNameAsync(senderUserId, cancellationToken);
                    return MapToSendMessageResponse(existing, conversationId, existingSenderName, isDuplicate: true);
                }

                throw new ValidationException(
                    "ClientRequestId has already been used for a different message.");
            }
        }

        // Persist the bytes first: the database row references the stored file, so a
        // failed write must never leave a row pointing at a missing file.
        var fileName = $"{Guid.NewGuid()}{Path.GetExtension(attachment.FileName).ToLowerInvariant()}";
        var relativeUrl = DocumentPath.MessageAttachmentRelativeUrl(conversationId, fileName);
        var directory = _documentStorage.ConversationAttachmentsDirectory(conversationId);
        Directory.CreateDirectory(directory);
        var fullPath = Path.Combine(directory, fileName);
        await File.WriteAllBytesAsync(fullPath, attachment.Content, cancellationToken);

        var message = new Message
        {
            ConversationId = conversationId,
            SenderUserId = senderUserId,
            Content = caption,
            ClientRequestId = normalizedRequestId,
            AttachmentUrl = relativeUrl,
            AttachmentContentType = attachment.ContentType?.ToLowerInvariant(),
            AttachmentFileName = SanitizeDisplayFileName(attachment.FileName)
        };

        await _messageRepository.AddAsync(message, cancellationToken);

        try
        {
            await _messageRepository.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex) when (IsUniqueViolation(ex) && normalizedRequestId is not null)
        {
            // Lost the race against a concurrent send with the same ClientRequestId: the
            // other request persisted the file and the row, so drop our orphaned copy and
            // return the row that actually won instead of surfacing a unique-constraint error.
            TryDeleteAttachmentFile(fullPath);

            var duplicate = await _messageRepository.GetByClientRequestIdAsync(
                senderUserId, normalizedRequestId, cancellationToken);

            if (duplicate is not null)
            {
                var duplicateSenderName = await ResolveSenderNameAsync(senderUserId, cancellationToken);
                return MapToSendMessageResponse(duplicate, conversationId, duplicateSenderName, isDuplicate: true);
            }

            throw;
        }
        catch
        {
            // Any other failure: best-effort cleanup so a rejected insert never orphans a file.
            TryDeleteAttachmentFile(fullPath);
            throw;
        }

        var senderName = await ResolveSenderNameAsync(senderUserId, cancellationToken);

        await NotifyMessageSentAsync(conversationId, message, senderName, cancellationToken);

        return MapToSendMessageResponse(message, conversationId, senderName);
    }

    /// <summary>
    /// Streams a message's image attachment. Reuses the thread's own participant rule so
    /// only the hall owner, the initiating participant, or an Admin can read it, and
    /// resolves the path from the persisted URL (never from client input) so a traversal
    /// attempt cannot escape the document storage root.
    /// </summary>
    public async Task<StoredDocument> GetMessageAttachmentAsync(
        Guid conversationId,
        Guid messageId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var userId = GetAuthenticatedUserId();

        var conversation = await _conversationRepository.GetByIdWithHallAsync(conversationId, cancellationToken);

        if (conversation is null || conversation.Hall?.IsDeleted == true)
        {
            throw new NotFoundException(nameof(Conversation), conversationId);
        }

        EnsureParticipant(conversation, userId);

        // WESAL-TASK-10 (Edit 10 follow-up): the download has to obey the same hall-messaging
        // gate as the thread, both send paths and the conversation read. Without this a
        // locked owner was refused everything around the payment proof and could still
        // download the proof itself, which is the most sensitive object in the feature.
        EnsureOwnerMessagingAccess(conversation);

        var message = await _messageRepository.GetByIdAsync(messageId, cancellationToken);

        // The message must belong to the conversation named in the route, so a caller
        // cannot pair an arbitrary message id with a thread they are allowed to read.
        if (message is null || message.ConversationId != conversationId || !message.HasAttachment)
        {
            throw new NotFoundException("MessageAttachment", messageId);
        }

        var fullPath = DocumentPath.ResolveFullPath(_documentStorage.Root, message.AttachmentUrl!);

        if (fullPath is null || !File.Exists(fullPath))
        {
            throw new NotFoundException("MessageAttachment", messageId);
        }

        return new StoredDocument
        {
            RelativeUrl = message.AttachmentUrl!,
            FullPath = fullPath,
            ContentType = message.AttachmentContentType ?? "application/octet-stream",
            FileName = message.AttachmentFileName ?? Path.GetFileName(fullPath)
        };
    }

    /// <summary>
    /// Reduces the client-supplied file name to a safe display value (WESAL-TASK-4, Edit 4).
    /// The name is echoed to every other participant in the thread and returned in a
    /// Content-Disposition header on download, so it must never carry directory components
    /// or control characters. Falls back to the stored file name when nothing survives.
    /// </summary>
    private static string SanitizeDisplayFileName(string? original)
    {
        if (string.IsNullOrWhiteSpace(original))
        {
            return "attachment";
        }

        // Keep only the leaf segment: a client cannot smuggle in a path.
        var leaf = original.Split(['/', '\\'], StringSplitOptions.RemoveEmptyEntries).LastOrDefault() ?? string.Empty;

        var cleaned = new string(leaf
            .Where(c => !char.IsControl(c) && c != '"' && c != '\'')
            .ToArray())
            .Trim();

        return cleaned.Length == 0 ? "attachment" : cleaned;
    }

    private void TryDeleteAttachmentFile(string fullPath)
    {
        try
        {
            if (File.Exists(fullPath))
            {
                File.Delete(fullPath);
            }
        }
        catch (Exception)
        {
            // Best-effort: an orphaned file is preferable to failing an already-persisted message.
        }
    }

    private void EnsureParticipant(Conversation conversation, string senderUserId)
    {
        var isParticipant = string.Equals(senderUserId, conversation.SenderUserId, StringComparison.OrdinalIgnoreCase)
            || string.Equals(senderUserId, conversation.HallOwnerId, StringComparison.OrdinalIgnoreCase)
            || _currentUser.Roles.Contains(ApplicationRoles.Admin, StringComparer.OrdinalIgnoreCase);

        if (!isParticipant)
        {
            throw new ForbiddenException("You do not have access to this conversation.");
        }
    }

    private async Task<string> ResolveSenderNameAsync(string senderUserId, CancellationToken cancellationToken)
    {
        var users = await _conversationRepository.GetUserDisplayNamesAsync([senderUserId], cancellationToken);
        return users.FirstOrDefault(info => info.UserId == senderUserId)?.FullName ?? string.Empty;
    }

    private async Task NotifyMessageSentAsync(
        Guid conversationId,
        Message message,
        string senderName,
        CancellationToken cancellationToken)
    {
        try
        {
            await _notifier.NotifyMessageSentAsync(new MessageSentEvent
            {
                MessageId = message.Id,
                ConversationId = conversationId,
                SenderUserId = message.SenderUserId,
                SenderName = senderName,
                Content = message.Content ?? string.Empty,
                SentAt = message.CreatedAt,
                HasAttachment = message.HasAttachment,
                AttachmentUrl = message.HasAttachment
                    ? $"/api/v1/conversations/{conversationId}/messages/{message.Id}/attachment"
                    : null,
                AttachmentContentType = message.AttachmentContentType,
                AttachmentFileName = message.AttachmentFileName
            }, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception)
        {
            // Best-effort delivery: message is already persisted and accessible via thread retrieval.
        }
    }

    private void ValidateMessageContent(string content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            throw new ValidationException("Message content is required.");
        }

        if (content.Trim().Length > 1000)
        {
            throw new ValidationException("Message content must not exceed 1000 characters.");
        }
    }

    /// <summary>
    /// WESAL-TASK-10 (Edit 10): bounds the idempotency key for BOTH send paths.
    /// </summary>
    /// <remarks>
    /// The text path relied solely on <c>SendMessageRequestValidator</c>, which only runs for a
    /// non-null DTO over HTTP. The attachment path takes the value as a raw form field that no
    /// validator covers, so nothing bounded it at all and an over-long key reached the insert and
    /// came back as an unhandled database error. Enforcing it here means the limit is a property
    /// of the service rather than of whichever filter happened to run, and the two endpoints
    /// cannot drift apart again. A blank key is not an idempotency key and stays allowed — it is
    /// normalised to null by the caller.
    /// </remarks>
    private static void ValidateClientRequestId(string? clientRequestId)
    {
        if (string.IsNullOrWhiteSpace(clientRequestId))
        {
            return;
        }

        if (clientRequestId.Trim().Length > MessageLimits.MaximumClientRequestIdLength)
        {
            throw new ValidationException(
                $"Client request identifier must not exceed {MessageLimits.MaximumClientRequestIdLength} characters.");
        }
    }

    private static bool IsUniqueViolation(Exception ex)
    {
        return ex.Message.Contains("23505", StringComparison.Ordinal)
            || ex.InnerException is not null && ex.InnerException.Message.Contains("23505", StringComparison.Ordinal);
    }

    private static SendMessageResponse MapToSendMessageResponse(Message message, Guid conversationId, string senderName, bool isDuplicate = false)
    {
        return new SendMessageResponse
        {
            MessageId = message.Id,
            ConversationId = conversationId,
            SenderUserId = message.SenderUserId,
            SenderName = senderName,
            Content = message.Content ?? string.Empty,
            SentAt = message.CreatedAt,
            IsDuplicate = isDuplicate,
            HasAttachment = message.HasAttachment,
            AttachmentUrl = message.HasAttachment
                ? $"/api/v1/conversations/{conversationId}/messages/{message.Id}/attachment"
                : null,
            AttachmentContentType = message.AttachmentContentType,
            AttachmentFileName = message.AttachmentFileName
        };
    }

    private async Task DeliverPendingBookingNotificationsAsync(CancellationToken cancellationToken)
    {
        try
        {
            // WESAL-TASK-8 (Edit 8): the approval notice is retried the same way as the
            // rejection notice, so a requester who never received it still gets it on a
            // later read of their conversations.
            await _bookingAcceptanceService.DeliverPendingAcceptanceNotificationsAsync(cancellationToken);
            await _bookingRejectionService.DeliverPendingRejectionNotificationsAsync(cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception)
        {
            // Best-effort delivery: pending notifications stay pending and are retried on a later read.
        }
    }

    /// <summary>
    /// Who the caller is talking to, for the inbox row's counterparty.
    /// <para>
    /// WESAL-TASK-10, Edit 16. This was a latent two-party assumption that only becomes wrong
    /// once the Admin inbox is shared: the old rule returned <c>SenderUserId</c> to anybody who
    /// was not the stored sender, so an Admin opening a shared owner/Admin thread was shown
    /// <em>the colleague it happens to be filed under</em> as the other participant — the same
    /// person as themselves, and never the owner they were trying to talk to. Shared
    /// discoverability would have put that wrong name on every row of every Admin's inbox.
    /// </para>
    /// <para>
    /// The fix is not a special case for the stored Admin; it follows from the thread kind. On
    /// an Admin-side thread the counterpart is by definition the owner, whoever is looking. A
    /// seeker/owner thread keeps the original rule untouched, which is correct for both of its
    /// real shapes: the seeker who opened it, and the owner who was written to.
    /// </para>
    /// </summary>
    private static string OtherParticipantId(
        Conversation conversation,
        string userId,
        bool isAdmin,
        IReadOnlyCollection<string> adminUserIds)
    {
        if (isAdmin && ConversationAccess.IsAdminThread(conversation, adminUserIds))
        {
            return conversation.HallOwnerId;
        }

        return string.Equals(userId, conversation.SenderUserId, StringComparison.OrdinalIgnoreCase)
            ? conversation.HallOwnerId
            : conversation.SenderUserId;
    }

    private static ConversationResponse MapToResponse(Conversation conversation, string hallName, bool isExisting)
    {
        return new ConversationResponse
        {
            ConversationId = conversation.Id,
            HallId = conversation.HallId,
            HallName = hallName,
            InitiatorUserId = conversation.SenderUserId,
            OwnerUserId = conversation.HallOwnerId,
            CreatedAt = conversation.CreatedAt,
            IsExisting = isExisting
        };
    }

    public async Task MarkAsReadAsync(Guid conversationId, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var (conversation, userId) = await GetParticipantConversationAsync(conversationId, cancellationToken);

        try
        {
            await _conversationRepository.UpsertReadStateAsync(conversation.Id, userId, DateTimeOffset.UtcNow, cancellationToken);
        }
        catch (Exception ex) when (IsMissingTable(ex))
        {
            // ConversationReadStates table may not exist yet if migration is pending.
        }
    }

    /// <summary>
    /// Removes one conversation from the caller's own inbox (WESAL-TASK-6, Edit 6).
    ///
    /// Per-user and non-destructive. This records a hide watermark for the caller's own
    /// participant row and touches nothing else: the conversation, every message, and every
    /// other participant's inbox and history are unchanged. Because the watermark is a
    /// timestamp, the thread reappears in the caller's inbox on its own as soon as a new
    /// message arrives after it — see <see cref="ConversationReadState.HiddenAt"/>.
    ///
    /// Hiding is idempotent, and re-hiding a thread that had already re-appeared simply
    /// moves the watermark forward and hides it again.
    /// </summary>
    public async Task HideConversationAsync(Guid conversationId, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var (conversation, userId) = await GetParticipantConversationAsync(conversationId, cancellationToken);

        try
        {
            await _conversationRepository.HideConversationAsync(
                conversation.Id, userId, DateTimeOffset.UtcNow, cancellationToken);
        }
        catch (Exception ex) when (IsMissingTable(ex))
        {
            // Mirrors MarkAsReadAsync: a pending ConversationReadStates migration must not turn
            // a hide into a 500. The hide is best-effort inbox state, never a data operation,
            // so there is nothing to report and nothing at risk.
        }
    }

    /// <summary>
    /// The single per-conversation access rule (WESAL-TASK-6, Edit 6), shared by every
    /// operation that acts on one conversation by id.
    ///
    /// It exists in one place deliberately: a participant is the thread's sender, the hall
    /// owner, or an Admin, and a conversation whose hall has been deleted is reported as
    /// not-found so a deleted hall cannot be probed through its threads. Authentication is
    /// checked before the lookup so an anonymous caller cannot distinguish "no such
    /// conversation" from "not allowed", and every caller gets exactly this rule.
    /// </summary>
    private async Task<(Conversation Conversation, string UserId)> GetParticipantConversationAsync(
        Guid conversationId,
        CancellationToken cancellationToken)
    {
        var userId = GetAuthenticatedUserId();

        var conversation = await _conversationRepository.GetByIdWithHallAsync(conversationId, cancellationToken);
        if (conversation is null || conversation.Hall?.IsDeleted == true)
        {
            throw new NotFoundException(nameof(Conversation), conversationId);
        }

        var isParticipant = string.Equals(userId, conversation.SenderUserId, StringComparison.OrdinalIgnoreCase)
            || string.Equals(userId, conversation.HallOwnerId, StringComparison.OrdinalIgnoreCase)
            || _currentUser.Roles.Contains(ApplicationRoles.Admin, StringComparer.OrdinalIgnoreCase);

        if (!isParticipant)
        {
            throw new ForbiddenException("You do not have access to this conversation.");
        }

        return (conversation, userId);
    }

    public async Task<UnreadCountResponse> GetUnreadCountAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var userId = GetAuthenticatedUserId();

        try
        {
            var count = await _conversationRepository.GetUnreadConversationCountAsync(
                userId,
                _currentUser.Roles.Contains(ApplicationRoles.Admin, StringComparer.OrdinalIgnoreCase),
                cancellationToken);
            return new UnreadCountResponse { UnreadCount = count };
        }
        catch (Exception ex) when (IsMissingTable(ex))
        {
            // ConversationReadStates table may not exist yet if migration is pending.
            return new UnreadCountResponse { UnreadCount = 0 };
        }
    }

    private static bool IsMissingTable(Exception ex)
    {
        return ex.Message.Contains("42P01", StringComparison.Ordinal)
            || (ex.InnerException is not null && IsMissingTable(ex.InnerException));
    }

    private void EnsureAuthenticated()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to start a conversation.");
        }
    }

    private string GetAuthenticatedUserId()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to access your conversations.");
        }

        return _currentUser.UserId;
    }

    private void EnsureRegisteredUserOrHallOwner()
    {
        if (!_currentUser.Roles.Contains(ApplicationRoles.RegisteredUser, StringComparer.OrdinalIgnoreCase)
            && !_currentUser.Roles.Contains(ApplicationRoles.HallOwner, StringComparer.OrdinalIgnoreCase)
            && !_currentUser.Roles.Contains(ApplicationRoles.Admin, StringComparer.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Only registered users can initiate a conversation.");
        }
    }

    private void EnsureNotSelfContact(Hall hall)
    {
        if (string.Equals(_currentUser.UserId, hall.OwnerId, StringComparison.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("You cannot start a conversation with your own hall.");
        }
    }

    /// <summary>
    /// Hall-management messaging gate (US-ADMIN-05/07, FR-SUB-01/05), defined once in
    /// <see cref="ConversationAccess"/> and shared with the SignalR hub and the live-push
    /// filter. WESAL-TASK-10: it used to live only here, which let the hub and the
    /// attachment download drift away from it.
    /// </summary>
    private void EnsureOwnerMessagingAccess(Conversation conversation)
        => ConversationAccess.EnsureOwnerMessagingAccess(
            conversation.Hall,
            string.Equals(_currentUser.UserId, conversation.HallOwnerId, StringComparison.OrdinalIgnoreCase),
            _currentUser.Roles.Contains(ApplicationRoles.Admin, StringComparer.OrdinalIgnoreCase));
}
