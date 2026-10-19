using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Domain.Notifications;
using ValidationException = Wesal.Domain.Exceptions.ValidationException;

namespace Wesal.Infrastructure.Admin;

/// <summary>
/// The mechanics every Administrator decision on a coordinator or photographer account
/// request shares (WESAL Tasks 5/6): the status-transition guard, reason/notes validation,
/// resolving the hall-less Admin↔user conversation, posting the rendered notification text
/// as that thread's message, writing the durable notification row inside the caller's
/// transaction, and the post-commit best-effort realtime push.
/// </summary>
/// <remarks>
/// <para>
/// This deliberately owns no transaction. Each review service wraps its own
/// status change, message, and durable notification in ONE
/// <see cref="IUnitOfWork.ExecuteInTransactionAsync"/> — exactly the shape the setup and
/// hall-review flows already use — so a decision can never commit half-applied. Only
/// <see cref="DispatchBestEffortAsync"/> runs outside the commit, because a SignalR push
/// must never be able to roll a committed decision back.
/// </para>
/// <para>
/// The Admin thread has NO hall (its HallId is null): the thread's identity is the
/// requesting user, resolved by <see cref="IConversationRepository.GetAdminUserConversationAsync"/>.
/// Its two parties are recorded the same way an owner/Admin thread records them —
/// the acting Admin (or <see cref="PlatformSenders.AdminFallback"/>) in SenderUserId and the
/// coordinator/photographer in HallOwnerId — so the shared Admin inbox, unread rules and
/// access gate all recognise it without a special case.
/// </para>
/// </remarks>
public sealed class AccountRequestReviewActions
{
    private readonly ICurrentUserService _currentUser;
    private readonly IConversationRepository _conversationRepository;
    private readonly IMessageRepository _messageRepository;
    private readonly IUserNotificationWriter _notificationWriter;
    private readonly INotificationService _notificationService;
    private readonly INotificationDispatcher _notificationDispatcher;
    private readonly ILogger<AccountRequestReviewActions> _logger;

    public AccountRequestReviewActions(
        ICurrentUserService currentUser,
        IConversationRepository conversationRepository,
        IMessageRepository messageRepository,
        IUserNotificationWriter notificationWriter,
        INotificationService notificationService,
        INotificationDispatcher notificationDispatcher,
        ILogger<AccountRequestReviewActions> logger)
    {
        _currentUser = currentUser;
        _conversationRepository = conversationRepository;
        _messageRepository = messageRepository;
        _notificationWriter = notificationWriter;
        _notificationService = notificationService;
        _notificationDispatcher = notificationDispatcher;
        _logger = logger;
    }

    /// <summary>
    /// The acting Admin's own id, or the platform's Admin-side sentinel when there is no
    /// authenticated caller (a background call, or a test harness) — the same rule
    /// <c>AdminHallReviewService</c> applies, so a thread created here is recognised as
    /// Admin-side by the shared inbox in exactly the same way.
    /// </summary>
    public string ResolveAdminUserId()
        => _currentUser.IsAuthenticated && !string.IsNullOrWhiteSpace(_currentUser.UserId)
            ? _currentUser.UserId
            : PlatformSenders.AdminFallback;

    /// <summary>
    /// Refuses a decision that would write the status the account ALREADY has, so a
    /// double-clicked approve/reject/request-changes can never send a second notification
    /// or post a second message. Any other transition is allowed by design: an Admin may
    /// approve a previously rejected account, reject a live one, or reopen a
    /// needs-changes review.
    /// </summary>
    /// <param name="current">The account's status before the decision.</param>
    /// <param name="target">The status the decision would set.</param>
    /// <param name="subject">What is being decided, used in the error message.</param>
    /// <exception cref="ConflictException">Already in the target status.</exception>
    public static void EnsureTransitionAllowed(
        AccountApprovalStatus current,
        AccountApprovalStatus target,
        string subject)
    {
        if (current != target)
        {
            return;
        }

        throw new ConflictException(
            $"This {subject} is already {StatusLabel(target)}; the decision was not applied.");
    }

    /// <summary>
    /// The mandatory rejection reason: required, trimmed, and bounded so an over-long
    /// reason becomes a clean 400 instead of overflowing the localized sentence and the
    /// 1000-character message column it is persisted into.
    /// </summary>
    public static string ValidateAndTrimReason(string? reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ValidationException("A rejection reason is required.");
        }

        var trimmed = reason.Trim();

        if (trimmed.Length > AccountRequestReviewLimits.MaximumReasonLength)
        {
            throw new ValidationException(
                $"The rejection reason cannot exceed {AccountRequestReviewLimits.MaximumReasonLength} characters.");
        }

        return trimmed;
    }

    /// <summary>
    /// The mandatory request-changes notes: required, trimmed, bounded by the message
    /// column they are posted into (requirement 6.5).
    /// </summary>
    public static string ValidateAndTrimNotes(string? notes)
    {
        if (string.IsNullOrWhiteSpace(notes))
        {
            throw new ValidationException("Notes describing what must be edited are required.");
        }

        var trimmed = notes.Trim();

        if (trimmed.Length > AccountRequestReviewLimits.MaximumNotesLength)
        {
            throw new ValidationException(
                $"The notes cannot exceed {AccountRequestReviewLimits.MaximumNotesLength} characters.");
        }

        return trimmed;
    }

    /// <summary>
    /// Resolves this user's hall-less Admin request conversation, creating it on demand.
    /// Opening a thread (the "contact" actions) never posts a placeholder message, so this
    /// is safe to call from a read-only endpoint; the review flows then post the rendered
    /// notification text into the very thread this returns.
    /// </summary>
    public async Task<(Conversation Conversation, bool IsExisting)> ResolveOrCreateConversationAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        var existing = await _conversationRepository.GetAdminUserConversationAsync(userId, cancellationToken);

        if (existing is not null)
        {
            return (existing, true);
        }

        var conversation = new Conversation
        {
            HallId = null,
            SenderUserId = ResolveAdminUserId(),
            HallOwnerId = userId
        };

        await _conversationRepository.AddAsync(conversation, cancellationToken);
        return (conversation, false);
    }

    /// <summary>
    /// Renders the notification in the RECIPIENT's own language and stages the durable
    /// <see cref="UserNotification"/> row. Not saved here: the row commits together with
    /// the status change and the conversation message through the caller's transaction,
    /// so a notification can never claim a decision that rolled back (or vice versa).
    /// </summary>
    public async Task<NotificationContent> BuildAndPersistNotificationAsync(
        NotificationKind kind,
        string recipientUserId,
        IReadOnlyDictionary<string, string?>? values,
        string? targetId,
        CancellationToken cancellationToken = default)
    {
        var content = await _notificationService.BuildAsync(
            kind,
            recipientUserId,
            values,
            targetId,
            cancellationToken);

        await _notificationWriter.AddAsync(new UserNotification
        {
            Id = Guid.NewGuid(),
            RecipientUserId = recipientUserId,
            Kind = content.Kind,
            Language = SupportedLanguages.ToCode(content.Language),
            Title = content.Title,
            Body = content.Body,
            ActionLabel = content.ActionLabel,
            ActionTarget = content.ActionTarget,
            TargetId = content.TargetId,
            CreatedAt = DateTimeOffset.UtcNow,
            ReadAt = null
        }, cancellationToken);

        return content;
    }

    /// <summary>
    /// Posts the given text (the rendered notification body for a rejection, the raw notes
    /// for a request-changes) into the Admin thread as the acting Admin. Not saved here —
    /// the caller's transaction flushes it together with everything else it commits.
    /// </summary>
    public async Task PostMessageAsync(
        Conversation conversation,
        string content,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            throw new ValidationException("A message requires content.");
        }

        await _messageRepository.AddAsync(new Message
        {
            ConversationId = conversation.Id,
            SenderUserId = ResolveAdminUserId(),
            Content = content
        }, cancellationToken);
    }

    /// <summary>
    /// The realtime twin of the committed durable notification, run strictly AFTER the
    /// commit: a SignalR outage cannot fail the response, roll the decision back, or make
    /// the caller believe nothing was delivered. Returns whether the push reached the hub.
    /// </summary>
    public async Task<bool> DispatchBestEffortAsync(
        NotificationKind kind,
        string recipientUserId,
        IReadOnlyDictionary<string, string?>? values,
        string? targetId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await _notificationDispatcher.DispatchAsync(kind, recipientUserId, values, targetId, cancellationToken);
            return true;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Realtime dispatch of {Kind} for user {UserId} failed after commit",
                kind,
                recipientUserId);
            return false;
        }
    }

    private static string StatusLabel(AccountApprovalStatus status)
        => status switch
        {
            AccountApprovalStatus.Approved => "approved",
            AccountApprovalStatus.Pending => "pending review",
            AccountApprovalStatus.Rejected => "rejected",
            AccountApprovalStatus.NeedsChanges => "marked as needing changes",
            _ => status.ToString()
        };
}
