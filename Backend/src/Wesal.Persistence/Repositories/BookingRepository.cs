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
            await _context.Database.ExecuteSqlInterpolatedAsync(
                $"""
                INSERT INTO wesal."HallAvailabilities" ("Id", "HallId", "Date", "PeriodType", "Status", "CreatedAt", "UpdatedAt")
                VALUES ({Guid.NewGuid()}, {hallId}, {date}, {(int)periodType}, {(int)AvailabilityStatus.Booked}, {DateTimeOffset.UtcNow}, {DateTimeOffset.UtcNow})
                ON CONFLICT ("HallId", "Date", "PeriodType") DO NOTHING;
                """,
                cancellationToken);

            return await _context.HallAvailabilities
                .Where(availability =>
                    availability.HallId == hallId
                    && availability.Date == date
                    && availability.PeriodType == periodType
                    && availability.Status == AvailabilityStatus.Available)
                .ExecuteUpdateAsync(
                    set =>
                        set.SetProperty(availability => availability.Status, AvailabilityStatus.Booked)
                            .SetProperty(availability => availability.UpdatedAt, DateTimeOffset.UtcNow),
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
}