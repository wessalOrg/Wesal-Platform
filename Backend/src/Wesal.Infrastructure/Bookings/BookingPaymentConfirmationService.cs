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
/// WESAL-TASK-8 (Edit 8): the owner's confirmation that the deposit (عربون) was received.
///
/// This is the single step that officially books a booking. Everything before it only
/// holds the hours: the request claims them as Reserved, and the approval records the
/// deposit without touching them. Here the booking is stamped as paid and its hours are
/// promoted from Reserved to Booked, both in one transaction, so a requester is never told
/// the hall is booked for them until the money is in the owner's hands.
///
/// Once confirmed, the booking is final: the same flag is what makes rejection and
/// cancellation refuse it, because the money has changed hands.
/// </summary>
public sealed class BookingPaymentConfirmationService : IBookingPaymentConfirmationService
{
    private readonly IBookingRepository _bookingRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUser;

    public BookingPaymentConfirmationService(
        IBookingRepository bookingRepository,
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUser)
    {
        _bookingRepository = bookingRepository;
        _unitOfWork = unitOfWork;
        _currentUser = currentUser;
    }

    public async Task<ConfirmBookingPaymentResultDto> ConfirmPaymentAsync(
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

        // The checks below are for a clear error message; the race is still resolved by
        // the conditional UPDATE inside the transaction, which is the real gate.
        if (booking.Status == BookingStatus.Pending)
        {
            throw new ConflictException(
                "The booking request has not been approved yet, so there is no deposit to confirm.");
        }

        if (booking.Status == BookingStatus.Rejected)
        {
            throw new ConflictException("The booking request was rejected, so its deposit cannot be confirmed.");
        }

        if (booking.Status == BookingStatus.Cancelled)
        {
            throw new ConflictException("The booking request was cancelled, so its deposit cannot be confirmed.");
        }

        if (booking.DepositPaymentConfirmedAt is not null)
        {
            throw new ConflictException("The deposit for this booking was already confirmed.");
        }

        var slotStarts = booking.Slots
            .OrderBy(slot => slot.StartTime)
            .Select(slot => slot.StartTime)
            .ToList();

        var confirmedAt = DateTimeOffset.UtcNow;

        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            var updatedRows = await _bookingRepository.ConfirmDepositPaymentAsync(
                booking.Id,
                confirmedAt,
                cancellationToken);

            if (updatedRows == 0)
            {
                throw new ConflictException(
                    "The deposit for this booking was already confirmed, or the booking is no longer approved.");
            }

            // The hours only become officially booked now, and only for a booking that still
            // holds them: the promotion fires on Reserved or already-Booked slots, never on
            // an Available one. A zero result means the booking lost its hold - it was
            // rejected or cancelled - so nothing is confirmed and the whole transaction is
            // rolled back, leaving the booking unpaid rather than half-booked.
            var booked = await _bookingRepository.ConfirmReservedHourlySlotsAsync(
                booking.HallId,
                booking.Date,
                slotStarts,
                cancellationToken);

            if (booked != slotStarts.Count)
            {
                throw new ConflictException(
                    "This booking no longer holds its reserved hours, so the deposit cannot be confirmed. Please re-check the request.");
            }

            booking.DepositPaymentConfirmedAt = confirmedAt;

            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }, cancellationToken);

        return MapToResult(booking, slotStarts, confirmedAt);
    }

    private void EnsureAuthenticatedHallOwner()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to confirm a deposit payment.");
        }

        if (!_currentUser.Roles.Contains(ApplicationRoles.HallOwner, StringComparer.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Only the hall owner can confirm a deposit payment.");
        }
    }

    private void EnsureHallOwnership(Booking booking)
    {
        if (!string.Equals(_currentUser.UserId, booking.Hall?.OwnerId, StringComparison.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Only the hall owner can confirm the deposit for this booking.");
        }
    }

    private static ConfirmBookingPaymentResultDto MapToResult(
        Booking booking,
        IReadOnlyList<TimeOnly> slotStarts,
        DateTimeOffset confirmedAt)
        => new()
        {
            BookingId = booking.Id,
            HallId = booking.HallId,
            HallName = booking.Hall?.Name ?? string.Empty,
            RequesterUserId = booking.RequesterUserId,
            Date = booking.Date,
            SlotStarts = slotStarts,
            TimeRange = booking.HourlyTimeRange,
            Status = BookingStatus.Accepted,
            DepositAmount = booking.DepositAmount,
            DepositPaymentConfirmedAt = confirmedAt
        };
}
