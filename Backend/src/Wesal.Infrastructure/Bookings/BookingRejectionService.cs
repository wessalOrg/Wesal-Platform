using System.Globalization;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
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

        if (booking.Status == BookingStatus.Rejected)
        {
            return MapToResult(booking, isAlreadyRejected: true);
        }

        booking.Status = BookingStatus.Rejected;
        booking.RejectionReason = request.Reason.Trim();

        await _unitOfWork.SaveChangesAsync(cancellationToken);

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
            Content = BuildRejectionContent(booking, hall)
        };

        await _messageRepository.AddAsync(message, cancellationToken);

        booking.RejectionMessageId = message.Id;

        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private static string BuildRejectionContent(Booking booking, Hall hall)
    {
        var requestedDate = booking.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        return $"Your booking request for {hall.Name} on {requestedDate} for the {booking.Period} period was rejected by the hall owner. Reason: {booking.RejectionReason}";
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
            Period = booking.Period,
            RequesterUserId = booking.RequesterUserId,
            RejectionReason = booking.RejectionReason ?? string.Empty,
            NotificationStatus = status,
            IsAlreadyRejected = isAlreadyRejected
        };
    }
}