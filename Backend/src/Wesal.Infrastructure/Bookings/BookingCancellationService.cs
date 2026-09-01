using System.Globalization;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Bookings;

public sealed class BookingCancellationService : IBookingCancellationService
{
    private readonly IBookingRepository _bookingRepository;
    private readonly IConversationRepository _conversationRepository;
    private readonly IMessageRepository _messageRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUser;

    public BookingCancellationService(
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

    public async Task<CancelBookingResultDto> CancelBookingAsync(
        Guid hallId,
        Guid bookingId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        EnsureAuthenticatedRequester();

        var booking = await _bookingRepository.GetByIdWithHallAsync(bookingId, cancellationToken);

        if (booking is null
            || booking.HallId != hallId
            || booking.Hall?.IsDeleted == true)
        {
            throw new NotFoundException(nameof(Booking), bookingId);
        }

        EnsureRequesterOwnership(booking);

        if (booking.Status != BookingStatus.Pending)
        {
            throw new ConflictException(BuildFinalizedMessage(booking.Status));
        }

        IWesalTransaction? transaction = null;

        try
        {
            transaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);

            var updatedRows = await _bookingRepository.CancelPendingAsync(
                booking.Id,
                booking.RequesterUserId,
                cancellationToken);

            if (updatedRows == 0)
            {
                throw new ConflictException(
                    "The booking request is no longer in the pending state and cannot be cancelled; it may have just been processed.");
            }

            var hasOtherActiveBooking = await _bookingRepository.HasOtherActiveBookingsAsync(
                booking.HallId,
                booking.Date,
                booking.Period,
                booking.Id,
                cancellationToken);

            if (!hasOtherActiveBooking)
            {
                await _bookingRepository.ReleasePeriodAsync(
                    booking.HallId,
                    booking.Date,
                    booking.Period,
                    cancellationToken);
            }

            await DeliverCancellationMessageAsync(booking, cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            throw;
        }
        finally
        {
            if (transaction is not null)
            {
                await transaction.DisposeAsync();
            }
        }

        return MapToResult(booking);
    }

    private void EnsureAuthenticatedRequester()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to cancel a booking request.");
        }

        if (!_currentUser.Roles.Contains(ApplicationRoles.RegisteredUser, StringComparer.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Only the regular user who submitted the booking request can cancel it.");
        }
    }

    private void EnsureRequesterOwnership(Booking booking)
    {
        if (!string.Equals(_currentUser.UserId, booking.RequesterUserId, StringComparison.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("You can only cancel your own booking request.");
        }
    }

    private async Task DeliverCancellationMessageAsync(Booking booking, CancellationToken cancellationToken)
    {
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
            SenderUserId = booking.RequesterUserId,
            Content = BuildCancellationContent(booking, hall)
        };

        await _messageRepository.AddAsync(message, cancellationToken);
    }

    private static string BuildCancellationContent(Booking booking, Hall hall)
    {
        var requestedDate = booking.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        return $"Your booking request for {hall.Name} on {requestedDate} for the {booking.Period} period was cancelled by the requester.";
    }

    private static string BuildFinalizedMessage(BookingStatus status)
        => status switch
        {
            BookingStatus.Accepted => "The booking request was already accepted and cannot be cancelled.",
            BookingStatus.Rejected => "The booking request was already rejected and cannot be cancelled.",
            BookingStatus.Cancelled => "The booking request has already been cancelled.",
            _ => "The booking request is not pending and cannot be cancelled."
        };

    private static CancelBookingResultDto MapToResult(Booking booking)
        => new()
        {
            BookingId = booking.Id,
            HallId = booking.HallId,
            HallName = booking.Hall?.Name ?? string.Empty,
            RequesterUserId = booking.RequesterUserId,
            Date = booking.Date,
            Period = booking.Period,
            Status = BookingStatus.Cancelled
        };
}