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

    public async Task<int> CancelPendingAsync(
        Guid bookingId,
        string requesterUserId,
        CancellationToken cancellationToken = default)
    {
        if (_context.Database.IsRelational())
        {
            return await _context.Bookings
                .Where(booking =>
                    booking.Id == bookingId
                    && booking.RequesterUserId == requesterUserId
                    && booking.Status == BookingStatus.Pending)
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
                && booking.Status == BookingStatus.Pending)
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

    public async Task<int> AcceptPendingAsync(
        Guid bookingId,
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
        pending.UpdatedAt = DateTimeOffset.UtcNow;

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
            var affected = await ReserveOneHourlySlotAsync(hallId, date, startTime, cancellationToken);

            if (affected == 0)
            {
                // A conflicting slot stops the walk. The caller runs this inside a
                // transaction, so the slots already taken in this loop are rolled back and
                // the booking is never persisted with a partially-reserved set of hours.
                return reserved;
            }

            reserved++;
        }

        return reserved;
    }

    private async Task<int> ReserveOneHourlySlotAsync(
        Guid hallId,
        DateOnly date,
        TimeOnly startTime,
        CancellationToken cancellationToken)
    {
        if (_context.Database.IsRelational())
        {
            // Single-statement conditional upsert so reserving a fresh
            // (HallId, Date, StartTime) hourly slot succeeds atomically:
            // - no row yet        -> inserted as Booked, 1 row affected
            // - row Available     -> updated to Booked,  1 row affected
            // - row already Booked -> WHERE excludes the update, 0 rows affected
            return await _context.Database.ExecuteSqlInterpolatedAsync(
                $"""
                INSERT INTO wesal."HallSlotAvailabilities" ("Id", "HallId", "Date", "StartTime", "Status", "CreatedAt", "UpdatedAt")
                VALUES ({Guid.NewGuid()}, {hallId}, {date}, {startTime}, {(int)HallSlotStatus.Booked}, {DateTimeOffset.UtcNow}, {DateTimeOffset.UtcNow})
                ON CONFLICT ("HallId", "Date", "StartTime")
                DO UPDATE
                SET "Status" = {(int)HallSlotStatus.Booked},
                    "UpdatedAt" = {DateTimeOffset.UtcNow}
                WHERE wesal."HallSlotAvailabilities"."Status" <> {(int)HallSlotStatus.Booked};
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
                Status = HallSlotStatus.Booked
            });

            await _context.SaveChangesAsync(cancellationToken);

            return 1;
        }

        if (existing.Status == HallSlotStatus.Booked)
        {
            return 0;
        }

        existing.Status = HallSlotStatus.Booked;
        existing.UpdatedAt = DateTimeOffset.UtcNow;

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
            // Only re-open a slot that is currently Booked; a missing row means the slot
            // was never reserved, which is already "available" for the seeker catalog.
            return await _context.HallSlotAvailabilities
                .Where(slot =>
                    slot.HallId == hallId
                    && slot.Date == date
                    && slot.StartTime == startTime
                    && slot.Status == HallSlotStatus.Booked)
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

        if (slot is null || slot.Status != HallSlotStatus.Booked)
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