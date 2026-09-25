using Wesal.Domain.Entities;
using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IBookingRepository
{
    Task AddAsync(Booking booking, CancellationToken cancellationToken = default);

    Task<Booking?> GetByIdWithHallAsync(Guid bookingId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Booking>> GetPendingRejectionNotificationsAsync(CancellationToken cancellationToken = default);

    Task<int> CancelPendingAsync(Guid bookingId, string requesterUserId, CancellationToken cancellationToken = default);

    Task<int> AcceptPendingAsync(Guid bookingId, CancellationToken cancellationToken = default);

    Task<int> DeleteAsync(Guid bookingId, CancellationToken cancellationToken = default);

    // Hourly-slot model. The legacy two-period members (ReservePeriodAsync /
    // ReleasePeriodAsync / HasOtherActiveBookingsAsync) were removed with the legacy
    // tables; availability is now expressed exclusively as calendar day + hourly slots.
    // Default interface members keep the lighter test fakes compiling; the real
    // BookingRepository overrides them, and NotSupportedException here guarantees a
    // partial implementation can never silently accept an hourly request.

    Task<bool> IsDayOpenAsync(
        Guid hallId,
        DateOnly date,
        CancellationToken cancellationToken = default)
        => throw new NotSupportedException("Hourly-slot availability is not supported by this booking repository.");

    Task<IReadOnlyList<HallDayAvailability>> GetDayGatesAsync(
        Guid hallId,
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken = default)
        => throw new NotSupportedException("Hourly-slot availability is not supported by this booking repository.");

    Task<IReadOnlyList<HallSlotAvailability>> GetHourlySlotsAsync(
        Guid hallId,
        DateOnly date,
        CancellationToken cancellationToken = default)
        => throw new NotSupportedException("Hourly-slot availability is not supported by this booking repository.");

    /// <summary>
    /// Atomically reserves every requested hourly slot. Returns the number of slots
    /// actually reserved, which equals <paramref name="startTimes"/> only when all of
    /// them were free. A partial result must be treated as a conflict and rolled back.
    /// </summary>
    Task<int> ReserveHourlySlotsAsync(
        Guid hallId,
        DateOnly date,
        IReadOnlyList<TimeOnly> startTimes,
        CancellationToken cancellationToken = default)
        => throw new NotSupportedException("Hourly-slot availability is not supported by this booking repository.");

    /// <summary>
    /// Re-opens the given hourly slots, skipping any slot that another active booking
    /// still holds. Used by the accept/cancel/reject/delete lifecycle so a multi-hour
    /// booking frees all of its hours.
    ///
    /// The slots are passed in by the caller, which has already loaded the booking,
    /// rather than re-queried here. Deletion hard-removes the booking row, so a release
    /// that re-queried by id would find nothing and strand the hours as Booked forever.
    /// </summary>
    Task<int> ReleaseBookingSlotsAsync(
        Guid bookingId,
        Guid hallId,
        DateOnly date,
        IReadOnlyList<TimeOnly> slotStarts,
        CancellationToken cancellationToken = default)
        => throw new NotSupportedException("Hourly-slot availability is not supported by this booking repository.");

    // Owner day-block write path. SetDayOpenAsync creates or updates the (HallId, Date)
    // gate; HasActiveBookingsOnDayAsync lets the owner-facing service refuse to silently
    // orphan a live booking when a whole day is blocked. "Active" means Pending or Accepted.

    Task SetDayOpenAsync(
        Guid hallId,
        DateOnly date,
        bool isOpen,
        CancellationToken cancellationToken = default)
        => throw new NotSupportedException("Hourly-slot availability is not supported by this booking repository.");

    Task<bool> HasActiveBookingsOnDayAsync(
        Guid hallId,
        DateOnly date,
        CancellationToken cancellationToken = default)
        => throw new NotSupportedException("Hourly-slot availability is not supported by this booking repository.");

    // Guards the hourly window against shrinking past a live booking. The seeker catalog
    // is generated from [HourlySlotStart, HourlySlotEnd), so narrowing the window would
    // make an already-booked hour vanish from the catalog while the booking itself stayed
    // real and active. The owner-facing service turns a true result into the same
    // ConflictException it already uses when a day-block would orphan a live booking.

    Task<bool> HasActiveHourlyBookingsOutsideWindowAsync(
        Guid hallId,
        TimeOnly windowStart,
        TimeOnly windowEnd,
        CancellationToken cancellationToken = default)
        => throw new NotSupportedException("Hourly-slot availability is not supported by this booking repository.");
}