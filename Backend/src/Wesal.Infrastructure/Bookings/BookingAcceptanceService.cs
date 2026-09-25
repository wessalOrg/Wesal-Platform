using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Bookings;

/// <summary>
/// Accepts a pending booking request on behalf of the authenticated Hall Owner
/// (US-OWNER-11, FR-BOOK-01). The owner is resolved from the JWT session; ownership
/// is enforced by comparing the session user id to the persisted hall owner id so a
/// caller can never accept another owner's booking. Acceptance transitions the booking
/// from Pending to Accepted.
///
/// WESAL-TASK-1: acceptance IS the publish step. For an hourly booking the 60-minute
/// slot is marked Booked in the same transaction as the approval, so the owner never
/// performs a second "publish" action. Legacy two-period bookings are untouched and the
/// legacy period is not marked Booked by this service.
///
/// The accept-vs-cancel race is resolved at the database level via an atomic conditional
/// UPDATE (AcceptPendingAsync / CancelPendingAsync): exactly one wins per row. A lost
/// race surfaces as a ConflictException so the caller knows the request was already
/// processed.
/// </summary>
public sealed class BookingAcceptanceService : IBookingAcceptanceService
{
    private readonly IBookingRepository _bookingRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUser;

    public BookingAcceptanceService(
        IBookingRepository bookingRepository,
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUser)
    {
        _bookingRepository = bookingRepository;
        _unitOfWork = unitOfWork;
        _currentUser = currentUser;
    }

    public async Task<AcceptBookingResultDto> AcceptBookingAsync(
        Guid hallId,
        Guid bookingId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        EnsureAuthenticatedHallOwner();

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
            var updatedRows = await _bookingRepository.AcceptPendingAsync(
                booking.Id,
                cancellationToken);

            if (updatedRows == 0)
            {
                throw new ConflictException(
                    "The booking request is no longer in the pending state and cannot be accepted; it may have just been processed.");
            }

            // WESAL-TASK-1: there is no separate publish step. The booking's hours were
            // already reserved when the request was created, so approving re-asserts every
            // one of its slots as Booked in the same transaction as the approval. A slot
            // that is already Booked is left untouched, so the call is idempotent and a
            // multi-hour booking is always published as a whole.
            await _bookingRepository.ReserveHourlySlotsAsync(
                booking.HallId,
                booking.Date,
                booking.Slots.Select(slot => slot.StartTime).ToList(),
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }, cancellationToken);

        return MapToResult(booking);
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

    private static AcceptBookingResultDto MapToResult(Booking booking)
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
            Status = BookingStatus.Accepted
        };
}
