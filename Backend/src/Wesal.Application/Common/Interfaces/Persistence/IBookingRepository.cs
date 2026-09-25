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

    Task<int> ReservePeriodAsync(
        Guid hallId,
        DateOnly date,
        BookingPeriodType periodType,
        CancellationToken cancellationToken = default);

    // WESAL-TASK-1 hourly-slot model (additive; the legacy two-period methods above
    // stay dormant and untouched). These operate on HallSlotAvailability /
    // HallDayAvailability and the new Booking.SlotStart / Booking.NameOnBooking fields.
    // Default interface members keep legacy/dormant implementations (and the
    // legacy-only test fakes) compiling unchanged; the real BookingRepository
    // overrides all four, and a NotSupportedException here guarantees a dormant
    // implementation can never silently accept an hourly request.

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

    Task<int> ReserveHourlySlotAsync(
        Guid hallId,
        DateOnly date,
        TimeOnly startTime,
        CancellationToken cancellationToken = default)
        => throw new NotSupportedException("Hourly-slot availability is not supported by this booking repository.");

    // Owner day-block write path (WESAL-TASK-1). SetDayOpenAsync creates or updates the
    // (HallId, Date) gate; HasActiveBookingsOnDayAsync lets the owner-facing service
    // refuse to silently orphan a live booking when a whole day is blocked. "Active"
    // reuses the same rule as HasOtherActiveBookingsAsync: Pending or Accepted.

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

    // Hourly lifecycle support (WESAL-TASK-1). The booking lifecycle (accept / cancel /
    // reject / delete) branches on Booking.IsHourlyBooking and uses these two members for
    // hourly bookings, so an hourly booking releases its own HallSlotAvailability row
    // instead of a legacy two-period HallAvailability row. ReleaseHourlySlotAsync only
    // re-opens a slot that is currently Booked; it never touches any other slot/date.

    Task<bool> HasOtherActiveHourlyBookingsAsync(
        Guid hallId,
        DateOnly date,
        TimeOnly startTime,
        Guid bookingId,
        CancellationToken cancellationToken = default)
        => throw new NotSupportedException("Hourly-slot availability is not supported by this booking repository.");

    Task<int> ReleaseHourlySlotAsync(
        Guid hallId,
        DateOnly date,
        TimeOnly startTime,
        CancellationToken cancellationToken = default)
        => throw new NotSupportedException("Hourly-slot availability is not supported by this booking repository.");
}