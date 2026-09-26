using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Domain.Notifications;

namespace Wesal.Infrastructure.Bookings;

/// <summary>
/// Accepts a pending booking request on behalf of the authenticated Hall Owner
/// (US-OWNER-11, FR-BOOK-01). The owner is resolved from the JWT session; ownership
/// is enforced by comparing the session user id to the persisted hall owner id so a
/// caller can never accept another owner's booking. Acceptance transitions the booking
/// from Pending to Accepted.
///
/// WESAL-TASK-8 (Edit 8): approval is no longer the moment the hall gets booked. It is the
/// moment the owner states how much the requester must pay:
///   - the required deposit is validated and persisted on the booking;
///   - the hours stay Reserved, protected exactly as before, so no competing request can
///     take them while the payment is in flight;
///   - the requester is notified on the requester/owner conversation, so tapping the
///     notification opens the same chat thread used for rejection and payment proof;
///   - the hours become officially Booked only in
///     <see cref="BookingPaymentConfirmationService"/>, once the owner confirms the money
///     arrived, which is also the point after which the booking can no longer be rejected
///     or cancelled.
///
/// The accept-vs-cancel race is resolved at the database level via an atomic conditional
/// UPDATE (AcceptPendingAsync / CancelPendingAsync): exactly one wins per row. A lost
/// race surfaces as a ConflictException so the caller knows the request was already
/// processed.
/// </summary>
public sealed class BookingAcceptanceService : IBookingAcceptanceService
{
    private readonly IBookingRepository _bookingRepository;
    private readonly IConversationRepository _conversationRepository;
    private readonly IMessageRepository _messageRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUser;
    private readonly INotificationService _notificationService;
    private readonly INotificationDispatcher _notificationDispatcher;

    public BookingAcceptanceService(
        IBookingRepository bookingRepository,
        IConversationRepository conversationRepository,
        IMessageRepository messageRepository,
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUser,
        INotificationService notificationService,
        INotificationDispatcher notificationDispatcher)
    {
        _bookingRepository = bookingRepository;
        _conversationRepository = conversationRepository;
        _messageRepository = messageRepository;
        _unitOfWork = unitOfWork;
        _currentUser = currentUser;
        _notificationService = notificationService;
        _notificationDispatcher = notificationDispatcher;
    }

    public async Task<AcceptBookingResultDto> AcceptBookingAsync(
        Guid hallId,
        Guid bookingId,
        AcceptBookingRequestDto request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        EnsureAuthenticatedHallOwner();

        var depositAmount = EnsureValidDeposit(request?.DepositAmount);

        var booking = await _bookingRepository.GetByIdWithHallAsync(bookingId, cancellationToken);

        if (booking is null
            || booking.HallId != hallId
            || booking.Hall?.IsDeleted == true)
        {
            throw new NotFoundException(nameof(Booking), bookingId);
        }

        EnsureHallOwnership(booking);

        HallManagementAccess.EnsureAllowed(booking.Hall!);

        if (booking.Status != BookingStatus.Pending)
        {
            throw new ConflictException(BuildFinalizedMessage(booking.Status));
        }

        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            // WESAL-TASK-8 (Edit 8): the deposit is written by the same atomic conditional
            // UPDATE that flips the status, so the amount can never be persisted on a
            // booking that lost the accept race, and an approval is never recorded without
            // the amount it is for.
            var updatedRows = await _bookingRepository.AcceptPendingAsync(
                booking.Id,
                depositAmount,
                cancellationToken);

            if (updatedRows == 0)
            {
                throw new ConflictException(
                    "The booking request is no longer in the pending state and cannot be accepted; it may have just been processed.");
            }

            // Keep the tracked entity in step with the UPDATE above so the notice built
            // below describes the approved booking and carries the real deposit.
            booking.Status = BookingStatus.Accepted;
            booking.DepositAmount = depositAmount;

            // The hours are deliberately NOT touched: they are already Reserved from the
            // request and stay that way until the deposit is confirmed, so no competing
            // request can take them in the meantime.
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }, cancellationToken);

        var notificationStatus = BookingAcceptanceNotificationStatus.Deferred;

        try
        {
            await DeliverApprovalMessageAsync(booking, cancellationToken);

            // Reported from the recorded message id rather than from the call succeeding,
            // because a booking that already carries a notice counts as delivered without
            // anything being sent a second time.
            notificationStatus = booking.ApprovalMessageId is not null
                ? BookingAcceptanceNotificationStatus.Delivered
                : BookingAcceptanceNotificationStatus.Deferred;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception)
        {
            // The approval is already committed; a failed notice is left pending so a
            // later retry can deliver it instead of failing the owner's approval call.
            booking.ApprovalMessageId = null;
        }

        return MapToResult(booking, notificationStatus);
    }

    public async Task<int> DeliverPendingAcceptanceNotificationsAsync(
        CancellationToken cancellationToken = default)
    {
        var pending = await _bookingRepository.GetPendingAcceptanceNotificationsAsync(cancellationToken);

        var deliveredCount = 0;

        foreach (var booking in pending)
        {
            try
            {
                // Only a notice actually written counts as delivered, so a booking that
                // turns out to be already notified is not reported as fresh progress.
                if (await DeliverApprovalMessageAsync(booking, cancellationToken))
                {
                    deliveredCount++;
                }
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception)
            {
                booking.ApprovalMessageId = null;
                // The notification stays pending and is retried on a later delivery attempt.
            }
        }

        return deliveredCount;
    }

    /// <summary>
    /// WESAL-TASK-8 (Edit 8): sends the requester the approval notice on the
    /// requester/owner conversation, reusing the rejection pattern: the conversation is
    /// created on demand, the notice is stored as a Message so the thread is the single
    /// source of truth, and <c>ApprovalMessageId</c> makes delivery exactly-once.
    /// </summary>
    /// <returns>
    /// true when this call wrote the notice, false when the booking already had one and
    /// nothing was sent. Returning the distinction is what lets a retry report real
    /// progress instead of counting an already-satisfied booking.
    /// </returns>
    private async Task<bool> DeliverApprovalMessageAsync(Booking booking, CancellationToken cancellationToken)
    {
        if (booking.ApprovalMessageId is not null)
        {
            return false;
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
            // WESAL-TASK-13 (Edit 13): the notice text is no longer fixed Arabic. It is the
            // same catalog entry the push notification uses, rendered in the REQUESTER's own
            // stored language, so the durable thread record and the realtime notification can
            // never disagree about what the requester was told.
            Content = await BuildApprovalContentAsync(booking, cancellationToken)
        };

        await _messageRepository.AddAsync(message, cancellationToken);

        booking.ApprovalMessageId = message.Id;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // The click-through lands in this exact thread, which is where the requester sends
        // the deposit payment notice (Edit 8's flow).
        await _notificationDispatcher.DispatchAsync(
            NotificationKind.BookingAcceptedForRequester,
            booking.RequesterUserId,
            BookingNotificationValues.ForBooking(booking),
            conversation.Id.ToString(),
            cancellationToken);

        return true;
    }

    /// <summary>
    /// Builds the requester-facing approval notice (WESAL-TASK-8, localized by
    /// WESAL-TASK-13 / Edit 13). It states what the hall is available and how much the
    /// requester must pay as a deposit before the booking is final, which is the message
    /// that makes the requester aware of the second step.
    /// </summary>
    /// <remarks>
    /// WESAL-TASK-8 originally fixed this text to Arabic by product decision. Edit 13
    /// supersedes that: the wording is now resolved per recipient from
    /// <see cref="ApplicationUser.PreferredLanguage"/>, so the Arabic and the English carry
    /// the same deposit amount, date and time range.
    /// </remarks>
    private async Task<string> BuildApprovalContentAsync(Booking booking, CancellationToken cancellationToken)
    {
        var content = await _notificationService.BuildAsync(
            NotificationKind.BookingAcceptedForRequester,
            booking.RequesterUserId,
            BookingNotificationValues.ForBooking(booking),
            cancellationToken: cancellationToken);

        return content.Body;
    }

    /// <summary>
    /// The deposit is validated in the service as well as by the request validator, so the
    /// rule holds no matter which entry point reaches this method.
    /// </summary>
    private static decimal EnsureValidDeposit(decimal? depositAmount)
    {
        if (depositAmount is not { } amount
            || amount < BookingDeposits.MinimumAmount
            || amount > BookingDeposits.MaximumAmount)
        {
            throw new ValidationException(
                $"A deposit amount between {BookingDeposits.MinimumAmount} and {BookingDeposits.MaximumAmount} is required to accept a booking request.");
        }

        return amount;
    }

    private void EnsureAuthenticatedHallOwner()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to accept a booking request.");
        }

        if (!_currentUser.Roles.Contains(ApplicationRoles.HallOwner, StringComparer.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Only the hall owner can accept a booking request.");
        }
    }

    private void EnsureHallOwnership(Booking booking)
    {
        if (!string.Equals(_currentUser.UserId, booking.Hall?.OwnerId, StringComparison.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Only the hall owner can accept this booking request.");
        }
    }

    private static string BuildFinalizedMessage(BookingStatus status)
        => status switch
        {
            BookingStatus.Accepted => "The booking request was already accepted.",
            BookingStatus.Rejected => "The booking request was already rejected and cannot be accepted.",
            BookingStatus.Cancelled => "The booking request has already been cancelled and cannot be accepted.",
            _ => "The booking request is not pending and cannot be accepted."
        };

    private static AcceptBookingResultDto MapToResult(
        Booking booking,
        BookingAcceptanceNotificationStatus notificationStatus)
        => new()
        {
            BookingId = booking.Id,
            HallId = booking.HallId,
            HallName = booking.Hall?.Name ?? string.Empty,
            RequesterUserId = booking.RequesterUserId,
            Date = booking.Date,
            SlotStarts = booking.Slots
                .OrderBy(slot => slot.StartTime)
                .Select(slot => slot.StartTime)
                .ToList(),
            TimeRange = booking.HourlyTimeRange,
            Status = BookingStatus.Accepted,
            DepositAmount = booking.DepositAmount,
            DepositPaymentConfirmedAt = booking.DepositPaymentConfirmedAt,
            NotificationStatus = notificationStatus
        };
}
