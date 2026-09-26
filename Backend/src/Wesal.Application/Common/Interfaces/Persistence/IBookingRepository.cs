using Wesal.Domain.Entities;
using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IBookingRepository
{
    Task AddAsync(Booking booking, CancellationToken cancellationToken = default);

    Task<Booking?> GetByIdWithHallAsync(Guid bookingId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Booking>> GetPendingRejectionNotificationsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// WESAL-TASK-8 (Edit 8): approved bookings that still owe the requester an approval
    /// notice, so a delivery that failed after the approval was committed can be retried
    /// without re-sending notices that already went out.
    /// </summary>
    Task<IReadOnlyList<Booking>> GetPendingAcceptanceNotificationsAsync(CancellationToken cancellationToken = default)
        => throw new NotSupportedException("Hourly-slot availability is not supported by this booking repository.");

    /// <summary>
    /// Cancels a booking the requester still holds, meaning a pending request or an
    /// approved one whose deposit has not been confirmed (WESAL-TASK-8). Once the deposit
    /// is confirmed the row no longer matches, which is how a paid booking is protected
    /// from cancellation.
    /// </summary>
    Task<int> CancelPendingAsync(Guid bookingId, string requesterUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// WESAL-TASK-8 (Edit 8): atomically flips a pending request to Accepted and records the
    /// required deposit in the same statement, so an approval is never stored without the
    /// amount it is for. Returns 0 when the row is no longer Pending, which is how a lost
    /// accept-vs-cancel race surfaces.
    /// </summary>
    Task<int> AcceptPendingAsync(Guid bookingId, decimal depositAmount, CancellationToken cancellationToken = default)
        => throw new NotSupportedException("Hourly-slot availability is not supported by this booking repository.");

    /// <summary>
    /// WESAL-TASK-8 (Edit 8): atomically stamps that the owner received the deposit. The row
    /// only matches while it is Accepted and the confirmation is still outstanding, so the
    /// call is safe against concurrent duplicates and against a booking that has since been
    /// rejected or cancelled. Returns 0 in those cases.
    /// </summary>
    Task<int> ConfirmDepositPaymentAsync(
        Guid bookingId,
        DateTimeOffset confirmedAt,
        CancellationToken cancellationToken = default)
        => throw new NotSupportedException("Hourly-slot availability is not supported by this booking repository.");

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
    /// Atomically claims every requested hourly slot for a new booking request, moving
    /// each one Available -&gt; Reserved. Returns the number of slots actually claimed,
    /// which equals <paramref name="startTimes"/> only when all of them were free. A
    /// partial result must be treated as a conflict and rolled back.
    /// <para>
    /// WESAL-TASK-8 (Edit 8): a claimed slot is held like a booked one, so a second request
    /// for the same hours is refused while the first is still live. The hours only become
    /// officially <see cref="HallSlotStatus.Booked"/> when the owner confirms the deposit.
    /// </para>
    /// </summary>
    Task<int> ReserveHourlySlotsAsync(
        Guid hallId,
        DateOnly date,
        IReadOnlyList<TimeOnly> startTimes,
        CancellationToken cancellationToken = default)
        => throw new NotSupportedException("Hourly-slot availability is not supported by this booking repository.");

    /// <summary>
    /// WESAL-TASK-8 (Edit 8): the payment-confirmation trigger. Promotes the booking's held
    /// hours from Reserved to Booked, and only then are they officially booked. Returns the
    /// number of slots promoted, which is less than <paramref name="startTimes"/> when a slot
    /// has lost its hold; a caller must treat that as a conflict rather than confirming a
    /// payment onto a slot the booking no longer owns.
    /// </summary>
    Task<int> ConfirmReservedHourlySlotsAsync(
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