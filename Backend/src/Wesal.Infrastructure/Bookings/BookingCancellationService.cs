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
    private readonly OwnerDashboard.IOwnerBookingRequestNotifier _ownerNotifier;

    public BookingCancellationService(
        IBookingRepository bookingRepository,
        IConversationRepository conversationRepository,
        IMessageRepository messageRepository,
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUser,
        OwnerDashboard.IOwnerBookingRequestNotifier ownerNotifier)
    {
        _bookingRepository = bookingRepository;
        _conversationRepository = conversationRepository;
        _messageRepository = messageRepository;
        _unitOfWork = unitOfWork;
        _currentUser = currentUser;
        _ownerNotifier = ownerNotifier;
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

        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            var updatedRows = await _bookingRepository.CancelPendingAsync(
                booking.Id,
                booking.RequesterUserId,
                cancellationToken);

            if (updatedRows == 0)
            {
                throw new ConflictException(
                    "The booking request is no longer in the pending state and cannot be cancelled; it may have just been processed.");
            }

            // WESAL-TASK-1: release every hourly slot this booking held. A cancelled
            // booking may span any number of hours, so all of them are re-opened, except a
            // slot another active booking still claims, whose protection is kept.
            await _bookingRepository.ReleaseBookingSlotsAsync(
                booking.Id,
                booking.HallId,
                booking.Date,
                [.. booking.Slots.Select(slot => slot.StartTime)],
                cancellationToken);

            // Keep the in-memory entity consistent with the atomic UPDATE above so the
            // conversation notice and the owner notification describe a cancelled request.
            booking.Status = BookingStatus.Cancelled;

            await DeliverCancellationMessageAsync(booking, cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }, cancellationToken);

        // WESAL-TASK-1: tell the owner the request is gone, outside the transaction and
        // best-effort, so a SignalR hiccup can neither roll back the cancellation nor
        // hide it from the owner's request list (which only ever shows Pending rows).
        await NotifyOwnerAsync(booking, cancellationToken);

        return MapToResult(booking);
    }

    /// <summary>
    /// Pushes the cancellation to the Hall Owner's dashboard group (WESAL-TASK-1).
    /// The owner id comes from
    /// booking.Hall.OwnerId (trusted backend data), and delivery failures are swallowed
    /// because the cancellation itself is already committed.
    /// </summary>
    private async Task NotifyOwnerAsync(Booking booking, CancellationToken cancellationToken)
    {
        var hall = booking.Hall;

        if (hall is null || string.IsNullOrWhiteSpace(hall.OwnerId))
        {
            return;
        }

        try
        {
            await _ownerNotifier.NotifyBookingRequestCancelledAsync(
                hall.OwnerId,
                new OwnerBookingCancellationNotificationEvent
                {
                    BookingId = booking.Id,
                    HallId = booking.HallId,
                    HallName = hall.Name,
                    Date = booking.Date,
                    SlotStarts = booking.Slots
                        .OrderBy(slot => slot.StartTime)
                        .Select(slot => slot.StartTime)
                        .ToList(),
                    TimeRange = booking.HourlyTimeRange,
                    RequesterUserId = booking.RequesterUserId,
                    RequesterName = ResolveRequesterName(booking),
                    OccurredAt = booking.UpdatedAt ?? DateTimeOffset.UtcNow
                },
                cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception)
        {
        }
    }

    private static string ResolveRequesterName(Booking booking)
    {
        if (!string.IsNullOrWhiteSpace(booking.NameOnBooking))
        {
            return booking.NameOnBooking.Trim();
        }

        return booking.RequesterUserId;
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

    /// <summary>
    /// Builds the chat notice left on the requester/owner conversation thread. A booking
    /// is always described by its real hourly range, so a multi-hour request reads as
    /// "09:00 - 12:00" rather than naming a booking period that no longer exists.
    /// </summary>
    private static string BuildCancellationContent(Booking booking, Hall hall)
    {
        var requestedDate = booking.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        return $"Your booking request for {hall.Name} on {requestedDate} for the {booking.HourlyTimeRange} slot was cancelled by the requester.";
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
            SlotStarts = booking.Slots
                .OrderBy(slot => slot.StartTime)
                .Select(slot => slot.StartTime)
                .ToList(),
            TimeRange = booking.HourlyTimeRange,
            Status = BookingStatus.Cancelled
        };
}