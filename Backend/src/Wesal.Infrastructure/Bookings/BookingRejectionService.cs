using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Conversations;

namespace Wesal.Infrastructure.Bookings;

public sealed class BookingRejectionService : IBookingRejectionService
{
    private readonly IBookingRepository _bookingRepository;
    private readonly IConversationRepository _conversationRepository;
    private readonly IMessageRepository _messageRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUser;
    private readonly INotificationService _notificationService;
    private readonly INotificationDispatcher _notificationDispatcher;
    private readonly IConversationNotifier _conversationNotifier;

    public BookingRejectionService(
        IBookingRepository bookingRepository,
        IConversationRepository conversationRepository,
        IMessageRepository messageRepository,
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUser,
        INotificationService notificationService,
        INotificationDispatcher notificationDispatcher,
        IConversationNotifier conversationNotifier)
    {
        _bookingRepository = bookingRepository;
        _conversationRepository = conversationRepository;
        _messageRepository = messageRepository;
        _unitOfWork = unitOfWork;
        _currentUser = currentUser;
        _notificationService = notificationService;
        _notificationDispatcher = notificationDispatcher;
        _conversationNotifier = conversationNotifier;
    }

    public async Task<RejectBookingResultDto> RejectBookingAsync(
        Guid hallId,
        Guid bookingId,
        RejectBookingRequestDto request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        EnsureAuthenticatedHallOwner();

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new ValidationException("A rejection reason is required.");
        }

        // WESAL-TASK-12 (Edit 12): the request validator already caps the reason for HTTP
        // callers, but the service is reachable directly and is where the database write
        // actually happens. Enforcing the bound here too means an over-long reason is refused
        // before any state changes, instead of failing as a database error after the booking
        // has already been rejected. The reason is wrapped in a localized sentence that is
        // persisted as a conversation message, whose own column is the same 1000 characters.
        if (request.Reason.Trim().Length > BookingRejectionReasons.MaximumLength)
        {
            throw new ValidationException(
                $"The rejection reason cannot exceed {BookingRejectionReasons.MaximumLength} characters.");
        }

        var booking = await _bookingRepository.GetByIdWithHallAsync(bookingId, cancellationToken);

        if (booking is null
            || booking.HallId != hallId
            || booking.Hall?.IsDeleted == true)
        {
            throw new NotFoundException(nameof(Booking), bookingId);
        }

        EnsureHallOwnership(booking);

        HallManagementAccess.EnsureAllowed(booking.Hall!);

        if (booking.Status == BookingStatus.Rejected)
        {
            return MapToResult(booking, isAlreadyRejected: true);
        }

        // WESAL-TASK-8 (Edit 8): a booking whose deposit the owner already confirmed can no
        // longer be rejected. The money has changed hands, so releasing the hours would
        // quietly hand a paid requester's slot to someone else. The confirmation is the
        // decision point, and it is recorded on the booking, not inferred from the status:
        // an approved booking is otherwise still rejectable.
        if (booking.DepositPaymentConfirmedAt is not null)
        {
            throw new ConflictException(
                "The deposit for this booking was already confirmed, so the request can no longer be rejected.");
        }

        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            booking.Status = BookingStatus.Rejected;
            booking.RejectionReason = request.Reason.Trim();

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            // WESAL-TASK-1: release the exact hours this booking held. A rejected booking
            // may span any number of hourly slots, so every one of them is re-opened —
            // except a slot another active booking still claims, whose protection is kept.
            await _bookingRepository.ReleaseBookingSlotsAsync(
                booking.Id,
                booking.HallId,
                booking.Date,
                [.. booking.Slots.Select(slot => slot.StartTime)],
                cancellationToken);
        }, cancellationToken);

        var notificationStatus = BookingRejectionNotificationStatus.Deferred;

        try
        {
            await DeliverRejectionMessageAsync(booking, cancellationToken);
            notificationStatus = BookingRejectionNotificationStatus.Delivered;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception)
        {
            booking.RejectionMessageId = null;
            notificationStatus = BookingRejectionNotificationStatus.Deferred;
        }

        return MapToResult(booking, isAlreadyRejected: false, notificationStatus);
    }

    public async Task<int> DeliverPendingRejectionNotificationsAsync(
        CancellationToken cancellationToken = default)
    {
        var pending = await _bookingRepository.GetPendingRejectionNotificationsAsync(cancellationToken);

        var deliveredCount = 0;

        foreach (var booking in pending)
        {
            try
            {
                await DeliverRejectionMessageAsync(booking, cancellationToken);
                deliveredCount++;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception)
            {
                booking.RejectionMessageId = null;
                // The notification stays pending and is retried on a later delivery attempt.
            }
        }

        return deliveredCount;
    }

    private async Task DeliverRejectionMessageAsync(Booking booking, CancellationToken cancellationToken)
    {
        if (booking.RejectionMessageId is not null)
        {
            return;
        }

        var hall = booking.Hall;

        if (hall is null || string.IsNullOrWhiteSpace(hall.OwnerId))
        {
            throw new NotFoundException(nameof(Hall), booking.HallId);
        }

        var conversation = await _conversationRepository.GetByHallAndUserAsync(
            booking.HallId,
            booking.RequesterUserId,
            cancellationToken);

        if (conversation is null)
        {
            conversation = new Conversation
            {
                HallId = booking.HallId,
                SenderUserId = booking.RequesterUserId,
                HallOwnerId = hall.OwnerId
            };

            await _conversationRepository.AddAsync(conversation, cancellationToken);
        }

        var message = new Message
        {
            ConversationId = conversation.Id,
            SenderUserId = hall.OwnerId,
            // WESAL-TASK-13 (Edit 13): rendered from the catalog in the REQUESTER's own
            // stored language, so the durable thread record and the push notification always
            // tell the requester the same thing, including the rejection reason.
            Content = await BuildRejectionContentAsync(booking, cancellationToken)
        };

        await _messageRepository.AddAsync(message, cancellationToken);

        booking.RejectionMessageId = message.Id;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // WESAL-TASK-12 (Edit 12): push the rejection into the open thread over the chat hub.
        // Previously this message was persisted but never pushed, so a seeker who already had
        // the conversation open saw nothing at all until they manually refetched. This is the
        // same realtime path a hand-typed message takes, so the open thread, the inbox unread
        // badge, and the persisted history all agree.
        await PushRejectionMessageAsync(conversation.Id, message, hall.OwnerId, cancellationToken);

        // WESAL-TASK-12 (Edit 12): the click-through resolves to this very thread, which was
        // just created on demand if the seeker had never messaged this owner before. So
        // "contact the hall owner" always opens a real, writable conversation instead of
        // erroring on a missing thread.
        await _notificationDispatcher.DispatchAsync(
            NotificationKind.BookingRejectedForRequester,
            booking.RequesterUserId,
            BookingNotificationValues.ForBooking(booking, reason: booking.RejectionReason?.Trim()),
            conversation.Id.ToString(),
            cancellationToken);
    }

    /// <summary>
    /// Best-effort realtime push of the rejection message, mirroring
    /// <c>ConversationService</c>'s own push. The message is already committed at this point, so
    /// a realtime failure must never fail the rejection or roll it back.
    /// </summary>
    private async Task PushRejectionMessageAsync(
        Guid conversationId,
        Message message,
        string ownerId,
        CancellationToken cancellationToken)
    {
        try
        {
            var users = await _conversationRepository.GetUserDisplayNamesAsync([ownerId], cancellationToken);
            var senderName = users.FirstOrDefault(info => info.UserId == ownerId)?.FullName ?? string.Empty;

            await _conversationNotifier.NotifyMessageSentAsync(
                new MessageSentEvent
                {
                    MessageId = message.Id,
                    ConversationId = conversationId,
                    SenderUserId = message.SenderUserId,
                    SenderName = senderName,
                    Content = message.Content ?? string.Empty,
                    SentAt = message.CreatedAt,
                    HasAttachment = false,
                    AttachmentUrl = null,
                    AttachmentContentType = null,
                    AttachmentFileName = null
                },
                cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception)
        {
            // The rejection is already persisted and readable via thread retrieval, so a failed
            // realtime push degrades to "the seeker sees it on next load", never to a lost
            // rejection.
        }
    }

    /// <summary>
    /// Builds the requester-facing rejection notice (WESAL-TASK-1, localized by
    /// WESAL-TASK-13 / Edit 13). It is stored as a Message on the requester/owner
    /// conversation (created on demand above), so tapping the notification opens that same
    /// chat thread.
    /// </summary>
    /// <remarks>
    /// WESAL-TASK-1 originally fixed this text to Arabic by product decision. Edit 13
    /// supersedes that: the wording, including the owner's reason, is now resolved per
    /// recipient from <c>ApplicationUser.PreferredLanguage</c>.
    /// </remarks>
    private async Task<string> BuildRejectionContentAsync(Booking booking, CancellationToken cancellationToken)
    {
        var content = await _notificationService.BuildAsync(
            NotificationKind.BookingRejectedForRequester,
            booking.RequesterUserId,
            BookingNotificationValues.ForBooking(booking, reason: booking.RejectionReason?.Trim()),
            cancellationToken: cancellationToken);

        return content.Body;
    }

    private void EnsureAuthenticatedHallOwner()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to reject a booking request.");
        }

        if (!_currentUser.Roles.Contains(ApplicationRoles.HallOwner, StringComparer.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Only the hall owner can reject a booking request.");
        }
    }

    private void EnsureHallOwnership(Booking booking)
    {
        if (!string.Equals(_currentUser.UserId, booking.Hall?.OwnerId, StringComparison.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Only the hall owner can reject this booking request.");
        }
    }

    private static RejectBookingResultDto MapToResult(
        Booking booking,
        bool isAlreadyRejected,
        BookingRejectionNotificationStatus? notificationStatus = null)
    {
        var status = notificationStatus
            ?? (booking.RejectionMessageId is null
                ? BookingRejectionNotificationStatus.Deferred
                : BookingRejectionNotificationStatus.Delivered);

        return new RejectBookingResultDto
        {
            BookingId = booking.Id,
            HallId = booking.HallId,
            HallName = booking.Hall?.Name ?? string.Empty,
            Date = booking.Date,
            SlotStarts = booking.Slots
                .OrderBy(slot => slot.StartTime)
                .Select(slot => slot.StartTime)
                .ToList(),
            TimeRange = booking.HourlyTimeRange,
            RequesterUserId = booking.RequesterUserId,
            RejectionReason = booking.RejectionReason ?? string.Empty,
            NotificationStatus = status,
            IsAlreadyRejected = isAlreadyRejected
        };
    }
}