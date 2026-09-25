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
    private readonly IHallRepository _hallRepository;
    private readonly ICurrentUserService _currentUser;
    private readonly IConversationNotifier _notifier;
    private readonly IDocumentStorage _documentStorage;

    public ConversationService(
        IConversationRepository conversationRepository,
        IMessageRepository messageRepository,
        IBookingRejectionService bookingRejectionService,
        IHallRepository hallRepository,
        ICurrentUserService currentUser,
        IConversationNotifier notifier,
        IDocumentStorage documentStorage)
    {
        _conversationRepository = conversationRepository;
        _messageRepository = messageRepository;
        _bookingRejectionService = bookingRejectionService;
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

    public async Task<ConversationResponse> GetConversationAsync(
        Guid conversationId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        EnsureAuthenticated();

        var conversation = await _conversationRepository.GetByIdWithHallAsync(conversationId, cancellationToken);

        if (conversation is null)
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

        await DeliverPendingRejectionNotificationsAsync(cancellationToken);

        var conversations = await _conversationRepository.GetParticipantConversationsAsync(userId, cancellationToken);

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
            .Select(conversation => OtherParticipantId(conversation, userId))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var nameLookup = (await _conversationRepository.GetUserDisplayNamesAsync(otherParticipantIds, cancellationToken))
            .ToDictionary(info => info.UserId, info => info.FullName, StringComparer.OrdinalIgnoreCase);

        return conversations
            .OrderByDescending(conversation => latestByConversation.GetValueOrDefault(conversation.Id)?.CreatedAt ?? conversation.CreatedAt)
            .ThenByDescending(conversation => conversation.Id)
            .Select(conversation =>
            {
                var latest = latestByConversation.GetValueOrDefault(conversation.Id);
                var otherParticipantId = OtherParticipantId(conversation, userId);

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
                    CreatedAt = conversation.CreatedAt
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

        await DeliverPendingRejectionNotificationsAsync(cancellationToken);

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
        ValidateMessageContent(request.Content);

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

        // The attachment is the payment proof, so the owner may post it even when unpaid.
        EnsureOwnerMessagingAccess(conversation, hasAttachment: true);

        var normalizedRequestId = string.IsNullOrWhiteSpace(clientRequestId) ? null : clientRequestId;

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

    private async Task DeliverPendingRejectionNotificationsAsync(CancellationToken cancellationToken)
    {
        try
        {
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

    private static string OtherParticipantId(Conversation conversation, string userId)
    {
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

        try
        {
            await _conversationRepository.UpsertReadStateAsync(conversationId, userId, DateTimeOffset.UtcNow, cancellationToken);
        }
        catch (Exception ex) when (IsMissingTable(ex))
        {
            // ConversationReadStates table may not exist yet if migration is pending.
        }
    }

    public async Task<UnreadCountResponse> GetUnreadCountAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var userId = GetAuthenticatedUserId();

        try
        {
            var count = await _conversationRepository.GetUnreadConversationCountAsync(userId, cancellationToken);
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
    /// Hall-management messaging gate (US-ADMIN-05/07, FR-SUB-01/05): when the current
    /// user is the OWNER of the conversation's hall, an Approved hall's messaging is
    /// subject to <see cref="HallManagementAccess"/> (Admin lock, payment required,
    /// system lock). PendingReview/Rejected hall threads stay open so the owner can
    /// read and reply to review/rejection messages (US-ADMIN-03). Seekers and Admins
    /// are never blocked by this gate.
    ///
    /// WESAL-TASK-4 (Edit 4) carves out one case: an owner posting an image attachment
    /// in their own owner/Admin thread stays allowed even when the hall is unpaid, because
    /// that attachment IS the subscription-payment proof the Admin asked for. Without this
    /// the payment notice would be unsendable exactly when it is needed. The carve-out is
    /// deliberately narrow — it applies only to the owner of this conversation, only to
    /// attachment posts, and only inside the thread; every text-only message and every
    /// Admin/seeker path is gated exactly as before. A manual Admin lock and the system
    /// lock still apply, so this only waives the payment requirement, never a lock.
    /// </summary>
    private void EnsureOwnerMessagingAccess(Conversation conversation, bool hasAttachment = false)
    {
        if (_currentUser.Roles.Contains(ApplicationRoles.Admin, StringComparer.OrdinalIgnoreCase))
        {
            return;
        }

        var hall = conversation.Hall;

        if (hall is null || hall.IsDeleted)
        {
            return;
        }

        var userId = _currentUser.UserId;

        var isOwner = string.Equals(userId, conversation.HallOwnerId, StringComparison.OrdinalIgnoreCase);

        if (!isOwner)
        {
            return;
        }

        if (hall.Status != HallStatus.Approved)
        {
            return;
        }

        // Edit 4 carve-out: an owner posting their subscription-payment proof is allowed
        // past the PAYMENT requirement only. Admin lock and system lock still apply.
        if (hasAttachment && hall.PaymentStatus != HallPaymentStatus.Paid)
        {
            if (hall.IsAdminLocked || hall.SystemLocked)
            {
                HallManagementAccess.EnsureAllowed(hall);
            }

            return;
        }

        HallManagementAccess.EnsureAllowed(hall);
    }
}
