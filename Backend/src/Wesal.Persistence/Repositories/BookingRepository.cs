using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public sealed class BookingRepository : IBookingRepository
{
    private readonly ApplicationDbContext _context;

    public BookingRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(Booking booking, CancellationToken cancellationToken = default)
    {
        await _context.Bookings.AddAsync(booking, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<Booking?> GetByIdWithHallAsync(Guid bookingId, CancellationToken cancellationToken = default)
    {
        return await _context.Bookings
            .Include(booking => booking.Hall)
            .Include(booking => booking.Slots)
            .FirstOrDefaultAsync(booking => booking.Id == bookingId, cancellationToken);
    }

    public async Task<IReadOnlyList<Booking>> GetPendingRejectionNotificationsAsync(
        CancellationToken cancellationToken = default)
    {
        return await _context.Bookings
            .Include(booking => booking.Hall)
            .Where(booking => booking.Status == BookingStatus.Rejected)
            .Where(booking => booking.RejectionReason != null)
            .Where(booking => booking.RejectionMessageId == null)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Booking>> GetPendingAcceptanceNotificationsAsync(
        CancellationToken cancellationToken = default)
    {
        // WESAL-TASK-8 (Edit 8): mirror of GetPendingRejectionNotificationsAsync - approved
        // bookings that still owe the requester an approval notice. A booking whose notice
        // already exists is skipped, so the retry cannot double-send.
        return await _context.Bookings
            .Include(booking => booking.Hall)
            .Where(booking => booking.Status == BookingStatus.Accepted)
            .Where(booking => booking.DepositAmount != null)
            .Where(booking => booking.ApprovalMessageId == null)
            .ToListAsync(cancellationToken);
    }

    public async Task<int> CancelPendingAsync(
        Guid bookingId,
        string requesterUserId,
        CancellationToken cancellationToken = default)
    {
        // WESAL-TASK-8 (Edit 8): cancellation is allowed while the deposit is still
        // outstanding, so an approved booking the requester never paid for can be called
        // off and its reserved hours re-opened. Once the deposit is confirmed the money
        // has changed hands and the row must no longer match, which is what blocks it.
        if (_context.Database.IsRelational())
        {
            return await _context.Bookings
                .Where(booking =>
                    booking.Id == bookingId
                    && booking.RequesterUserId == requesterUserId
                    && (booking.Status == BookingStatus.Pending
                        || booking.Status == BookingStatus.Accepted)
                    && booking.DepositPaymentConfirmedAt == null)
                .ExecuteUpdateAsync(
                    set =>
                        set.SetProperty(booking => booking.Status, BookingStatus.Cancelled)
                            .SetProperty(booking => booking.UpdatedAt, DateTimeOffset.UtcNow),
                    cancellationToken);
        }

        var pending = await _context.Bookings
            .Where(booking =>
                booking.Id == bookingId
                && booking.RequesterUserId == requesterUserId
                && (booking.Status == BookingStatus.Pending
                    || booking.Status == BookingStatus.Accepted)
                && booking.DepositPaymentConfirmedAt == null)
            .FirstOrDefaultAsync(cancellationToken);

        if (pending is null)
        {
            return 0;
        }

        pending.Status = BookingStatus.Cancelled;
        pending.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return 1;
    }

    /// <summary>
    /// WESAL-TASK-8 (Edit 8): atomically flips a pending request to Accepted and records the
    /// deposit the owner required in the same statement, so an approval can never be
    /// persisted without the amount it is for. The row only matches while it is still
    /// Pending, which is what resolves the accept-vs-cancel race.
    /// </summary>
    public async Task<int> AcceptPendingAsync(
        Guid bookingId,
        decimal depositAmount,
        CancellationToken cancellationToken = default)
    {
        if (_context.Database.IsRelational())
        {
            return await _context.Bookings
                .Where(booking =>
                    booking.Id == bookingId
                    && booking.Status == BookingStatus.Pending)
                .ExecuteUpdateAsync(
                    set =>
                        set.SetProperty(booking => booking.Status, BookingStatus.Accepted)
                            .SetProperty(booking => booking.DepositAmount, depositAmount)
                            .SetProperty(booking => booking.UpdatedAt, DateTimeOffset.UtcNow),
                    cancellationToken);
        }

        var pending = await _context.Bookings
            .Where(booking =>
                booking.Id == bookingId
                && booking.Status == BookingStatus.Pending)
            .FirstOrDefaultAsync(cancellationToken);

        if (pending is null)
        {
            return 0;
        }

        pending.Status = BookingStatus.Accepted;
        pending.DepositAmount = depositAmount;
        pending.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return 1;
    }

    /// <summary>
    /// WESAL-TASK-8 (Edit 8): atomically stamps the moment the owner confirmed receiving the
    /// deposit. The row only matches while it is Accepted and the confirmation is still
    /// outstanding, so two concurrent confirmations cannot both win, and a booking that was
    /// rejected or cancelled in the meantime can never be marked paid.
    /// </summary>
    public async Task<int> ConfirmDepositPaymentAsync(
        Guid bookingId,
        DateTimeOffset confirmedAt,
        CancellationToken cancellationToken = default)
    {
        if (_context.Database.IsRelational())
        {
            return await _context.Bookings
                .Where(booking =>
                    booking.Id == bookingId
                    && booking.Status == BookingStatus.Accepted
                    && booking.DepositPaymentConfirmedAt == null)
                .ExecuteUpdateAsync(
                    set =>
                        set.SetProperty(booking => booking.DepositPaymentConfirmedAt, confirmedAt)
                            .SetProperty(booking => booking.UpdatedAt, DateTimeOffset.UtcNow),
                    cancellationToken);
        }

        var approved = await _context.Bookings
            .Where(booking =>
                booking.Id == bookingId
                && booking.Status == BookingStatus.Accepted
                && booking.DepositPaymentConfirmedAt == null)
            .FirstOrDefaultAsync(cancellationToken);

        if (approved is null)
        {
            return 0;
        }

        approved.DepositPaymentConfirmedAt = confirmedAt;
        approved.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return 1;
    }

    public async Task<int> DeleteAsync(
        Guid bookingId,
        CancellationToken cancellationToken = default)
    {
        if (_context.Database.IsRelational())
        {
            return await _context.Bookings
                .Where(booking => booking.Id == bookingId)
                .ExecuteDeleteAsync(cancellationToken);
        }

        var booking = await _context.Bookings
            .FirstOrDefaultAsync(candidate => candidate.Id == bookingId, cancellationToken);

        if (booking is null)
        {
            return 0;
        }

        _context.Bookings.Remove(booking);

        await _context.SaveChangesAsync(cancellationToken);

        return 1;
    }

    public async Task<bool> IsDayOpenAsync(
        Guid hallId,
        DateOnly date,
        CancellationToken cancellationToken = default)
    {
        var dayGate = await _context.HallDayAvailabilities
            .AsNoTracking()
            .FirstOrDefaultAsync(
                day => day.HallId == hallId && day.Date == date,
                cancellationToken);

        // A missing per-day row defaults to Open under the hourly model.
        return dayGate?.IsOpen ?? true;
    }

    public async Task<IReadOnlyList<HallDayAvailability>> GetDayGatesAsync(
        Guid hallId,
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken = default)
    {
        return await _context.HallDayAvailabilities
            .AsNoTracking()
            .Where(day => day.HallId == hallId && day.Date >= fromDate && day.Date <= toDate)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<HallSlotAvailability>> GetHourlySlotsAsync(
        Guid hallId,
        DateOnly date,
        CancellationToken cancellationToken = default)
    {
        return await _context.HallSlotAvailabilities
            .AsNoTracking()
            .Where(slot => slot.HallId == hallId && slot.Date == date)
            .ToListAsync(cancellationToken);
    }

    /// <summary>
    /// WESAL-TASK-8 (Edit 8): claims every requested hourly slot for a new booking
    /// request, moving each one Available -> Reserved.
    /// <para>
    /// A Reserved slot is protected exactly like a booked one, so a second request for the
    /// same hours cannot take them while the first is still live. The conditional upsert is
    /// the single point of control for that guarantee, because the unique index on
    /// (HallId, Date, StartTime) allows only one row per hour: the update is allowed to
    /// fire <c>only</c> when the row is still Available, so a slot that is Reserved or
    /// Booked is never stolen.
    /// </para>
    /// <para>
    /// Returns the number of slots actually claimed, which equals
    /// <paramref name="startTimes"/> only when all of them were free. A partial result
    /// must be treated as a conflict and rolled back.
    /// </para>
    /// </summary>
    public async Task<int> ReserveHourlySlotsAsync(
        Guid hallId,
        DateOnly date,
        IReadOnlyList<TimeOnly> startTimes,
        CancellationToken cancellationToken = default)
    {
        if (startTimes.Count == 0)
        {
            return 0;
        }

        var reserved = 0;

        foreach (var startTime in startTimes)
        {
            var affected = await ClaimOneHourlySlotAsync(hallId, date, startTime, cancellationToken);

            if (affected == 0)
            {
                // A conflicting slot stops the walk. The caller runs this inside a
                // transaction, so the slots already taken in this loop are rolled back and
                // the booking is never persisted with a partially-held set of hours.
                return reserved;
            }

            reserved++;
        }

        return reserved;
    }

    /// <summary>
    /// WESAL-TASK-8 (Edit 8): the payment-confirmation trigger. Promotes the booking's
    /// hours from Reserved to Booked, and only now are they officially booked.
    /// <para>
    /// The update fires only for a slot that is currently held (Reserved or already
    /// Booked, which keeps the call idempotent). A slot that is Available means the booking
    /// lost its hold - it was rejected or cancelled - so nothing is touched and the caller
    /// sees a zero result and refuses to confirm.
    /// </para>
    /// </summary>
    public async Task<int> ConfirmReservedHourlySlotsAsync(
        Guid hallId,
        DateOnly date,
        IReadOnlyList<TimeOnly> startTimes,
        CancellationToken cancellationToken = default)
    {
        if (startTimes.Count == 0)
        {
            return 0;
        }

        var confirmed = 0;

        foreach (var startTime in startTimes)
        {
            var affected = await ConfirmOneHourlySlotAsync(hallId, date, startTime, cancellationToken);

            if (affected == 0)
            {
                return confirmed;
            }

            confirmed++;
        }

        return confirmed;
    }

    private async Task<int> ClaimOneHourlySlotAsync(
        Guid hallId,
        DateOnly date,
        TimeOnly startTime,
        CancellationToken cancellationToken)
    {
        if (_context.Database.IsRelational())
        {
            // Single-statement conditional upsert so claiming a fresh
            // (HallId, Date, StartTime) hourly slot succeeds atomically:
            // - no row yet        -> inserted as Reserved, 1 row affected
            // - row Available     -> updated to Reserved,  1 row affected
            // - row Reserved/Booked-> WHERE excludes the update, 0 rows affected
            return await _context.Database.ExecuteSqlInterpolatedAsync(
                $"""
                INSERT INTO wesal."HallSlotAvailabilities" ("Id", "HallId", "Date", "StartTime", "Status", "CreatedAt", "UpdatedAt")
                VALUES ({Guid.NewGuid()}, {hallId}, {date}, {startTime}, {(int)HallSlotStatus.Reserved}, {DateTimeOffset.UtcNow}, {DateTimeOffset.UtcNow})
                ON CONFLICT ("HallId", "Date", "StartTime")
                DO UPDATE
                SET "Status" = {(int)HallSlotStatus.Reserved},
                    "UpdatedAt" = {DateTimeOffset.UtcNow}
                WHERE wesal."HallSlotAvailabilities"."Status" = {(int)HallSlotStatus.Available};
                """,
                cancellationToken);
        }

        var existing = await _context.HallSlotAvailabilities
            .FirstOrDefaultAsync(
                slot => slot.HallId == hallId && slot.Date == date && slot.StartTime == startTime,
                cancellationToken);

        if (existing is null)
        {
            _context.HallSlotAvailabilities.Add(new HallSlotAvailability
            {
                HallId = hallId,
                Date = date,
                StartTime = startTime,
                Status = HallSlotStatus.Reserved
            });

            await _context.SaveChangesAsync(cancellationToken);

            return 1;
        }

        // Any held slot blocks a new claim. Checking for "not Available" rather than
        // "is Booked" is what keeps a Reserved slot from being stolen (WESAL-TASK-8).
        if (existing.Status != HallSlotStatus.Available)
        {
            return 0;
        }

        existing.Status = HallSlotStatus.Reserved;
        existing.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return 1;
    }

    private async Task<int> ConfirmOneHourlySlotAsync(
        Guid hallId,
        DateOnly date,
        TimeOnly startTime,
        CancellationToken cancellationToken)
    {
        if (_context.Database.IsRelational())
        {
            return await _context.Database.ExecuteSqlInterpolatedAsync(
                $"""
                INSERT INTO wesal."HallSlotAvailabilities" ("Id", "HallId", "Date", "StartTime", "Status", "CreatedAt", "UpdatedAt")
                VALUES ({Guid.NewGuid()}, {hallId}, {date}, {startTime}, {(int)HallSlotStatus.Booked}, {DateTimeOffset.UtcNow}, {DateTimeOffset.UtcNow})
                ON CONFLICT ("HallId", "Date", "StartTime")
                DO UPDATE
                SET "Status" = {(int)HallSlotStatus.Booked},
                    "UpdatedAt" = {DateTimeOffset.UtcNow}
                WHERE wesal."HallSlotAvailabilities"."Status" IN ({(int)HallSlotStatus.Reserved}, {(int)HallSlotStatus.Booked});
                """,
                cancellationToken);
        }

        var slot = await _context.HallSlotAvailabilities
            .FirstOrDefaultAsync(
                candidate => candidate.HallId == hallId && candidate.Date == date && candidate.StartTime == startTime,
                cancellationToken);

        if (slot is null)
        {
            return 0;
        }

        // An Available slot has lost its hold, so payment must not be confirmed onto it.
        if (slot.Status == HallSlotStatus.Available)
        {
            return 0;
        }

        slot.Status = HallSlotStatus.Booked;
        slot.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return 1;
    }

    public async Task SetDayOpenAsync(
        Guid hallId,
        DateOnly date,
        bool isOpen,
        CancellationToken cancellationToken = default)
    {
        if (_context.Database.IsRelational())
        {
            // Single-statement upsert on the (HallId, Date) unique index so an owner's
            // block/unblock is atomic even under concurrent taps: the row is inserted
            // when absent and updated in place when present.
            await _context.Database.ExecuteSqlInterpolatedAsync(
                $"""
                INSERT INTO wesal."HallDayAvailabilities" ("Id", "HallId", "Date", "IsOpen", "CreatedAt", "UpdatedAt")
                VALUES ({Guid.NewGuid()}, {hallId}, {date}, {isOpen}, {DateTimeOffset.UtcNow}, {DateTimeOffset.UtcNow})
                ON CONFLICT ("HallId", "Date")
                DO UPDATE
                SET "IsOpen" = {isOpen},
                    "UpdatedAt" = {DateTimeOffset.UtcNow};
                """,
                cancellationToken);

            return;
        }

        var existing = await _context.HallDayAvailabilities
            .FirstOrDefaultAsync(
                day => day.HallId == hallId && day.Date == date,
                cancellationToken);

        if (existing is null)
        {
            _context.HallDayAvailabilities.Add(new HallDayAvailability
            {
                HallId = hallId,
                Date = date,
                IsOpen = isOpen
            });

            await _context.SaveChangesAsync(cancellationToken);

            return;
        }

        existing.IsOpen = isOpen;
        existing.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<bool> HasActiveBookingsOnDayAsync(
        Guid hallId,
        DateOnly date,
        CancellationToken cancellationToken = default)
    {
        // Same "active" rule as HasOtherActiveBookingsAsync: a Pending or Accepted
        // booking is live and must not be silently orphaned by an owner day-block.
        return await _context.Bookings
            .AsNoTracking()
            .AnyAsync(
                booking =>
                    booking.HallId == hallId
                    && booking.Date == date
                    && (booking.Status == BookingStatus.Pending
                        || booking.Status == BookingStatus.Accepted),
                cancellationToken);
    }

    /// <summary>
    /// Re-opens every hourly slot the booking owns, skipping any slot that another
    /// active booking still holds. This is the single release path used by the whole
    /// accept/cancel/reject/delete lifecycle, so a booking that covers several hours
    /// always frees all of them.
    ///
    /// The slots arrive from the caller rather than being re-queried, because the delete
    /// path removes the booking row first and a re-query would then find nothing.
    /// </summary>
    public async Task<int> ReleaseBookingSlotsAsync(
        Guid bookingId,
        Guid hallId,
        DateOnly date,
        IReadOnlyList<TimeOnly> slotStarts,
        CancellationToken cancellationToken = default)
    {
        if (slotStarts.Count == 0)
        {
            return 0;
        }

        var released = 0;

        foreach (var slotStart in slotStarts)
        {
            var stillHeld = await _context.Bookings
                .AsNoTracking()
                .AnyAsync(
                    candidate =>
                        candidate.Id != bookingId
                        && candidate.HallId == hallId
                        && candidate.Date == date
                        && (candidate.Status == BookingStatus.Pending
                            || candidate.Status == BookingStatus.Accepted)
                        && candidate.Slots.Any(other => other.StartTime == slotStart),
                    cancellationToken);

            if (stillHeld)
            {
                continue;
            }

            released += await ReleaseOneHourlySlotAsync(
                hallId,
                date,
                slotStart,
                cancellationToken);
        }

        return released;
    }

    private async Task<int> ReleaseOneHourlySlotAsync(
        Guid hallId,
        DateOnly date,
        TimeOnly startTime,
        CancellationToken cancellationToken)
    {
        if (_context.Database.IsRelational())
        {
            // Release any slot this booking was holding, which is Booked after payment
            // confirmation and Reserved before it (WESAL-TASK-8). Matching on Booked alone
            // would silently skip a Reserved slot and strand it forever, costing the hall
            // that hour for good, so both held states are re-opened. A missing row means
            // the slot was never held, which is already "available" for seekers.
            return await _context.HallSlotAvailabilities
                .Where(slot =>
                    slot.HallId == hallId
                    && slot.Date == date
                    && slot.StartTime == startTime
                    && slot.Status != HallSlotStatus.Available)
                .ExecuteUpdateAsync(
                    set =>
                        set.SetProperty(slot => slot.Status, HallSlotStatus.Available)
                            .SetProperty(slot => slot.UpdatedAt, DateTimeOffset.UtcNow),
                    cancellationToken);
        }

        var slot = await _context.HallSlotAvailabilities
            .FirstOrDefaultAsync(
                candidate =>
                    candidate.HallId == hallId
                    && candidate.Date == date
                    && candidate.StartTime == startTime,
                cancellationToken);

        if (slot is null || slot.Status == HallSlotStatus.Available)
        {
            return 0;
        }

        slot.Status = HallSlotStatus.Available;
        slot.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return 1;
    }

    /// <summary>
    /// True when the hall still has a live booking that owns at least one slot whose
    /// start falls outside the candidate window [windowStart, windowEnd). Dates in the
    /// past are included on purpose: the booking is still a real record, and letting a
    /// window change silently strand it is exactly what this guard prevents.
    /// </summary>
    public async Task<bool> HasActiveHourlyBookingsOutsideWindowAsync(
        Guid hallId,
        TimeOnly windowStart,
        TimeOnly windowEnd,
        CancellationToken cancellationToken = default)
    {
        return await _context.Bookings
            .AsNoTracking()
            .AnyAsync(
                booking =>
                    booking.HallId == hallId
                    && (booking.Status == BookingStatus.Pending || booking.Status == BookingStatus.Accepted)
                    && booking.Slots.Any(slot => slot.StartTime < windowStart || slot.StartTime >= windowEnd),
                cancellationToken);
    }
}