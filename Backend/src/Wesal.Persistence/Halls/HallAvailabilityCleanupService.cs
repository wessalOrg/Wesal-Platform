using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Enums;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Halls;

public class HallAvailabilityCleanupService : IHallAvailabilityCleanupService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<HallAvailabilityCleanupService> _logger;

    public HallAvailabilityCleanupService(ApplicationDbContext dbContext, ILogger<HallAvailabilityCleanupService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<int> CleanupExpiredAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var nowTime = TimeOnly.FromDateTime(now);

        var bookedAvailabilities = await _dbContext.HallAvailabilities
            .Where(a => a.Status == AvailabilityStatus.Booked)
            .Include(a => a.Hall)
            .ToListAsync(cancellationToken);

        var hallIds = bookedAvailabilities.Select(a => a.HallId).Distinct().ToList();
        var periods = await _dbContext.HallBookingPeriods
            .Where(p => hallIds.Contains(p.HallId))
            .ToListAsync(cancellationToken);

        var periodMap = periods.GroupBy(p => p.HallId).ToDictionary(g => g.Key, g => g.ToDictionary(p => p.Type, p => p.EndTime));

        int cleaned = 0;
        foreach (var avail in bookedAvailabilities)
        {
            if (avail.Hall.IsDeleted)
            {
                avail.Status = AvailabilityStatus.Available;
                cleaned++;
                continue;
            }

            bool isExpired = false;
            if (avail.Date < today)
                isExpired = true;
            else if (avail.Date == today)
            {
                if (periodMap.TryGetValue(avail.HallId, out var hallPeriods) && hallPeriods.TryGetValue(avail.PeriodType, out var endTime))
                {
                    if (nowTime > endTime)
                        isExpired = true;
                }
            }

            if (!isExpired) continue;

            var hasActiveBooking = await _dbContext.Bookings.AnyAsync(b =>
                b.HallId == avail.HallId &&
                b.Date == avail.Date &&
                b.Period == avail.PeriodType &&
                (b.Status == BookingStatus.Pending || b.Status == BookingStatus.Accepted), cancellationToken);

            if (hasActiveBooking) continue;

            avail.Status = AvailabilityStatus.Available;
            cleaned++;
        }

        if (cleaned > 0)
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Cleaned {Count} expired public Booked availabilities", cleaned);
        }

        return cleaned;
    }

    public async Task<int> CleanupForHallAsync(Guid hallId, CancellationToken cancellationToken = default)
    {
        var hall = await _dbContext.Halls.FindAsync(new object[] { hallId }, cancellationToken);
        if (hall == null || hall.IsDeleted)
        {
            var availabilities = await _dbContext.HallAvailabilities.Where(a => a.HallId == hallId && a.Status == AvailabilityStatus.Booked).ToListAsync(cancellationToken);
            foreach (var avail in availabilities)
                avail.Status = AvailabilityStatus.Available;
            if (availabilities.Count > 0)
                await _dbContext.SaveChangesAsync(cancellationToken);
            return availabilities.Count;
        }
        return await CleanupExpiredAsync(cancellationToken);
    }
}
