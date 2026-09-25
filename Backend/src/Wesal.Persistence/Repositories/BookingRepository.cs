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

    public async Task<bool> HasOtherActiveBookingsAsync(
        Guid hallId,
        DateOnly date,
        BookingPeriodType periodType,
        Guid bookingId,
        CancellationToken cancellationToken = default)
    {
        return await _context.Bookings
            .AnyAsync(booking =>
                booking.HallId == hallId
                && booking.Date == date
                && booking.Period == periodType
                && booking.Id != bookingId
                && (booking.Status == BookingStatus.Pending
                    || booking.Status == BookingStatus.Accepted),
                cancellationToken);
    }

    public async Task<int> ReleasePeriodAsync(
        Guid hallId,
        DateOnly date,
        BookingPeriodType periodType,
        CancellationToken cancellationToken = default)
    {
        if (_context.Database.IsRelational())
        {
            return await _context.HallAvailabilities
                .Where(availability =>
                    availability.HallId == hallId
                    && availability.Date == date
                    && availability.PeriodType == periodType
                    && availability.Status == AvailabilityStatus.Booked)
                .ExecuteUpdateAsync(
                    set =>
                        set.SetProperty(availability => availability.Status, AvailabilityStatus.Available)
                            .SetProperty(availability => availability.UpdatedAt, DateTimeOffset.UtcNow),
                    cancellationToken);
        }

        var booked = await _context.HallAvailabilities
            .Where(availability =>
                availability.HallId == hallId
                && availability.Date == date
                && availability.PeriodType == periodType
                && availability.Status == AvailabilityStatus.Booked)
            .FirstOrDefaultAsync(cancellationToken);

        if (booked is null)
        {
            return 0;
        }

        booked.Status = AvailabilityStatus.Available;
        booked.UpdatedAt = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return 1;
    }

    public async Task<int> ReservePeriodAsync(
        Guid hallId,
        DateOnly date,
        BookingPeriodType periodType,
        CancellationToken cancellationToken = default)
    {
        if (_context.Database.IsRelational())
        {
            // Single-statement conditional upsert so that reserving a fresh
            // (HallId, Date, PeriodType) combination succeeds atomically:
            // - no row yet        -> inserted as Booked, 1 row affected
            // - row Available     -> updated to Booked,  1 row affected
            // - row already Booked -> WHERE excludes the update, 0 rows affected
            return await _context.Database.ExecuteSqlInterpolatedAsync(
                $"""
                INSERT INTO wesal."HallAvailabilities" ("Id", "HallId", "Date", "PeriodType", "Status", "CreatedAt", "UpdatedAt")
                VALUES ({Guid.NewGuid()}, {hallId}, {date}, {(int)periodType}, {(int)AvailabilityStatus.Booked}, {DateTimeOffset.UtcNow}, {DateTimeOffset.UtcNow})
                ON CONFLICT ("HallId", "Date", "PeriodType")
                DO UPDATE
                SET "Status" = {(int)AvailabilityStatus.Booked},
                    "UpdatedAt" = {DateTimeOffset.UtcNow}
                WHERE wesal."HallAvailabilities"."Status" <> {(int)AvailabilityStatus.Booked};
                """,
                cancellationToken);
        }

        var existing = await _context.HallAvailabilities
            .FirstOrDefaultAsync(availability =>
                availability.HallId == hallId
                && availability.Date == date
                && availability.PeriodType == periodType,
                cancellationToken);

        if (existing is null)
        {
            _context.HallAvailabilities.Add(new HallAvailability
            {
                HallId = hallId,
                Date = date,
                PeriodType = periodType,
                Status = AvailabilityStatus.Booked
            });

            await _context.SaveChangesAsync(cancellationToken);

            return 1;
        }

        if (existing.Status == AvailabilityStatus.Booked)
        {
            return 0;
        }

        existing.Status = AvailabilityStatus.Booked;
        existing.UpdatedAt = DateTimeOffset.UtcNow;

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

    public async Task<int> ReserveHourlySlotAsync(
        Guid hallId,
        DateOnly date,
        TimeOnly startTime,
        CancellationToken cancellationToken = default)
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

    public async Task<bool> HasOtherActiveHourlyBookingsAsync(
        Guid hallId,
        DateOnly date,
        TimeOnly startTime,
        Guid bookingId,
        CancellationToken cancellationToken = default)
    {
        // Hourly counterpart of HasOtherActiveBookingsAsync: matches on the real slot
        // start, never on the legacy Period, and excludes the booking being processed.
        // Legacy rows carry SlotStart = 00:00, so they can never collide with a real
        // hourly slot (the hourly window rejects anything before 09:00).
        return await _context.Bookings
            .AsNoTracking()
            .AnyAsync(
                booking =>
                    booking.HallId == hallId
                    && booking.Date == date
                    && booking.SlotStart == startTime
                    && booking.Id != bookingId
                    && (booking.Status == BookingStatus.Pending
                        || booking.Status == BookingStatus.Accepted),
                cancellationToken);
    }

    public async Task<int> ReleaseHourlySlotAsync(
        Guid hallId,
        DateOnly date,
        TimeOnly startTime,
        CancellationToken cancellationToken = default)
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
    /// WESAL-TASK-1 hardening: true when the hall still has a live hourly booking whose
    /// start falls outside the candidate window [windowStart, windowEnd).
    ///
    /// Only hourly bookings are considered (SlotStart differs from the legacy 00:00 marker),
    /// matching the hourly-vs-legacy discriminator used across the booking lifecycle. Dates
    /// in the past are included on purpose: the booking is still a real record, and letting
    /// a window change silently strand it is exactly what this guard prevents.
    /// </summary>
    public async Task<bool> HasActiveHourlyBookingsOutsideWindowAsync(
        Guid hallId,
        TimeOnly windowStart,
        TimeOnly windowEnd,
        CancellationToken cancellationToken = default)
    {
        var midnight = TimeOnly.MinValue;

        return await _context.Bookings
            .AsNoTracking()
            .AnyAsync(
                booking =>
                    booking.HallId == hallId
                    && booking.SlotStart != midnight
                    && (booking.Status == BookingStatus.Pending || booking.Status == BookingStatus.Accepted)
                    && (booking.SlotStart < windowStart || booking.SlotStart >= windowEnd),
                cancellationToken);
    }
}