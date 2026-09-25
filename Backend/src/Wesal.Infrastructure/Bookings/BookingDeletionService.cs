using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Bookings;

/// <summary>
/// Permanently deletes a booking on behalf of the authenticated Hall Owner
/// (US-OWNER-15). The owner is resolved from the JWT session; ownership is enforced
/// by comparing the session user id to the persisted hall owner id so a caller can
/// never delete another owner's booking (or a booking of another owner's hall).
///
/// Deletion is a terminal, hard delete: the booking row is removed and the exact unit
/// it held is released to Available when no other active (Pending or Accepted) booking
/// claims the same hall/date/slot. WESAL-TASK-1: that unit is the booking's 60-minute
/// HallSlotAvailability slot for an hourly booking, or its requested
/// HallAvailability period for a legacy two-period booking. Releasing it also clears
/// the public 'Booked' status, so public availability queries no longer report it as
/// Booked. No other period, date, slot, booking, conversation, or message is ever
/// touched: conversations are scoped to a hall and user (not to a booking), so deleting
/// a booking cannot orphan or break a conversation, and delivered rejection messages
/// remain as conversation history. Deleting a rejected/undelivered booking simply
/// removes the only source a deferred rejection notification is derived from, which
/// prevents a stale pending-booking notification.
///
/// The delete-vs-delete (and delete-vs-state-change) race is resolved at the
/// database level via an atomic conditional DELETE (DeleteAsync): exactly one
/// deletion wins per row, and a lost race surfaces as a ConflictException. The
/// whole operation runs inside a single database transaction so a failure never
/// leaves partial state (a deleted booking with a still-Booked period, or a
/// released period with no booking to justify it).
/// </summary>
public sealed class BookingDeletionService : IBookingDeletionService
{
    private readonly IBookingRepository _bookingRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUser;

    public BookingDeletionService(
        IBookingRepository bookingRepository,
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUser)
    {
        _bookingRepository = bookingRepository;
        _unitOfWork = unitOfWork;
        _currentUser = currentUser;
    }

    public async Task<DeleteBookingResultDto> DeleteBookingAsync(
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

        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            var deletedRows = await _bookingRepository.DeleteAsync(
                booking.Id,
                cancellationToken);

            if (deletedRows == 0)
            {
                throw new ConflictException(
                    "The booking has already been deleted and cannot be deleted again.");
            }

            // Re-open the exact unit this booking held, and only when no other active
            // booking still claims it, so another booking's protection is never released.
            // WESAL-TASK-1: an hourly booking re-opens its own HallSlotAvailability slot;
            // a legacy booking re-opens its legacy two-period row exactly as before.
            if (booking.IsHourlyBooking)
            {
                var hasCompetingHourlyClaim = await _bookingRepository.HasOtherActiveHourlyBookingsAsync(
                    booking.HallId,
                    booking.Date,
                    booking.SlotStart,
                    booking.Id,
                    cancellationToken);

                if (!hasCompetingHourlyClaim)
                {
                    await _bookingRepository.ReleaseHourlySlotAsync(
                        booking.HallId,
                        booking.Date,
                        booking.SlotStart,
                        cancellationToken);
                }
            }
            else
            {
                var hasCompetingClaim = await _bookingRepository.HasOtherActiveBookingsAsync(
                    booking.HallId,
                    booking.Date,
                    booking.Period,
                    booking.Id,
                    cancellationToken);

                if (!hasCompetingClaim)
                {
                    await _bookingRepository.ReleasePeriodAsync(
                        booking.HallId,
                        booking.Date,
                        booking.Period,
                        cancellationToken);
                }
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }, cancellationToken);

        return MapToResult(booking);
    }

    private void EnsureAuthenticatedHallOwner()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to delete a booking.");
        }

        if (!_currentUser.Roles.Contains(ApplicationRoles.HallOwner, StringComparer.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Only the hall owner can delete a booking.");
        }
    }

    private void EnsureHallOwnership(Booking booking)
    {
        if (!string.Equals(_currentUser.UserId, booking.Hall?.OwnerId, StringComparison.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Only the hall owner can delete this booking.");
        }
    }

    private static DeleteBookingResultDto MapToResult(Booking booking)
        => new()
        {
            BookingId = booking.Id,
            HallId = booking.HallId,
            HallName = booking.Hall?.Name ?? string.Empty,
            RequesterUserId = booking.RequesterUserId,
            Date = booking.Date,
            Period = booking.Period,
            SlotStart = booking.SlotStart,
            IsHourlyBooking = booking.IsHourlyBooking,
            Status = booking.Status
        };
}