using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Bookings;

public sealed class BookingRejectionService : IBookingRejectionService
{
    private readonly IBookingRepository _bookingRepository;
    private readonly IConversationRepository _conversationRepository;
    private readonly IMessageRepository _messageRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUser;

    public BookingRejectionService(
        IBookingRepository bookingRepository,
        IConversationRepository conversationRepository,
        IMessageRepository messageRepository,
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUser)
    {
        _bookingRepository = bookingRepository;
        _conversationRepository = conversationRepository;
        _messageRepository = messageRepository;
        _unitOfWork = unitOfWork;
        _currentUser = currentUser;
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
            Content = BuildRejectionContent(booking)
        };

        await _messageRepository.AddAsync(message, cancellationToken);

        booking.RejectionMessageId = message.Id;

        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Builds the requester-facing rejection notice (WESAL-TASK-1). The text is exactly
    /// the product-specified sentence with the owner's reason appended, and it is stored
    /// as a Message on the requester/owner conversation (created on demand above), so
    /// tapping the notification opens that same chat thread. The language is fixed
    /// Arabic by product decision and is independent of the hourly/legacy model.
    /// </summary>
    private static string BuildRejectionContent(Booking booking)
    {
        var reason = string.IsNullOrWhiteSpace(booking.RejectionReason)
            ? string.Empty
            : booking.RejectionReason.Trim();

        return $"تم رفض طلب الحجز الخاص بك للسبب الاتي: {reason}";
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