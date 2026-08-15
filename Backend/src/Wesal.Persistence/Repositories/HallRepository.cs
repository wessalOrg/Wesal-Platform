using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public class HallRepository : IHallRepository
{
    private readonly ApplicationDbContext _context;

    public HallRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => _context.Halls
            .AsNoTracking()
            .FirstOrDefaultAsync(hall => hall.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Hall>> GetApprovedHallsAsync(int count, CancellationToken cancellationToken = default)
        => await ApprovedHallsQuery()
            .OrderByDescending(hall => hall.CreatedAt)
            .ThenBy(hall => hall.Name)
            .Take(count)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Hall>> GetApprovedHallsByRegionAsync(
        HallRegion region,
        int count,
        CancellationToken cancellationToken = default)
        => await ApprovedHallsQuery()
            .Where(hall => hall.Region == region)
            .OrderByDescending(hall => hall.CreatedAt)
            .ThenBy(hall => hall.Name)
            .Take(count)
            .ToListAsync(cancellationToken);

    private IQueryable<Hall> ApprovedHallsQuery()
        => _context.Halls
            .AsNoTracking()
            .Where(hall => hall.Status == HallStatus.Approved && !hall.IsDeleted);

    public async Task<IReadOnlyList<HallImage>> GetHallImagesAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
        => await _context.HallImages
            .AsNoTracking()
            .Where(image => image.HallId == hallId && !image.IsDeleted)
            .OrderBy(image => image.DisplayOrder)
            .ThenBy(image => image.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<HallBookingPeriod>> GetBookingPeriodsAsync(
        IReadOnlyCollection<Guid> hallIds,
        CancellationToken cancellationToken = default)
    {
        if (hallIds.Count == 0)
        {
            return [];
        }

        return await _context.HallBookingPeriods
            .AsNoTracking()
            .Where(period => hallIds.Contains(period.HallId))
            .OrderBy(period => period.HallId)
            .ThenBy(period => period.Type)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<HallAvailability>> GetAvailabilityAsync(
        IReadOnlyCollection<Guid> hallIds,
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken = default)
    {
        if (hallIds.Count == 0)
        {
            return [];
        }

        return await _context.HallAvailabilities
            .AsNoTracking()
            .Where(availability =>
                hallIds.Contains(availability.HallId)
                && availability.Date >= fromDate
                && availability.Date <= toDate)
            .ToListAsync(cancellationToken);
    }
}
