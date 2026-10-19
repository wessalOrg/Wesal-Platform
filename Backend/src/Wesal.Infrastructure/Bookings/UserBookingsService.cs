using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Bookings;

/// <summary>
/// Returns the booking history of the authenticated Regular User ("My bookings").
/// The requester is resolved exclusively from the authenticated session, so a caller can
/// never read another user's bookings, and the read is strictly passive: no booking
/// status, availability, or reservation is ever changed.
/// </summary>
public sealed class UserBookingsService : IUserBookingsService
{
    private readonly IBookingRepository _bookingRepository;
    private readonly ICurrentUserService _currentUser;

    public UserBookingsService(
        IBookingRepository bookingRepository,
        ICurrentUserService currentUser)
    {
        _bookingRepository = bookingRepository;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<UserBookingDto>> GetMyBookingsAsync(
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to view your bookings.");
        }

        var bookings = await _bookingRepository.GetByRequesterAsync(
            _currentUser.UserId,
            cancellationToken);

        return bookings
            .Select(booking => new UserBookingDto
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
                Status = booking.Status,
                DepositAmount = booking.DepositAmount,
                DepositPaymentConfirmedAt = booking.DepositPaymentConfirmedAt,
                RejectionReason = booking.RejectionReason,
                RequestedAt = booking.CreatedAt
            })
            .ToList();
    }
}
