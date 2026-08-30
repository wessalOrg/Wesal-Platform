using Wesal.Domain.Entities;
using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IBookingRepository
{
    Task AddAsync(Booking booking, CancellationToken cancellationToken = default);

    Task<Booking?> GetByIdWithHallAsync(Guid bookingId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Booking>> GetPendingRejectionNotificationsAsync(CancellationToken cancellationToken = default);

    Task<int> CancelPendingAsync(Guid bookingId, string requesterUserId, CancellationToken cancellationToken = default);

    Task<bool> HasOtherActiveBookingsAsync(
        Guid hallId,
        DateOnly date,
        BookingPeriodType periodType,
        Guid bookingId,
        CancellationToken cancellationToken = default);

    Task<int> ReleasePeriodAsync(
        Guid hallId,
        DateOnly date,
        BookingPeriodType periodType,
        CancellationToken cancellationToken = default);
}