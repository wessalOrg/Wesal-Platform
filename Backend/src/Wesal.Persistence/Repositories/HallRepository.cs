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

    public async Task AddAsync(Hall hall, CancellationToken cancellationToken = default)
    {
        await _context.Halls.AddAsync(hall, cancellationToken);
    }

    public Task<Hall?> GetHallByIdForUpdateAsync(Guid id, CancellationToken cancellationToken = default)
        => _context.Halls.FirstOrDefaultAsync(hall => hall.Id == id, cancellationToken);

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

    public async Task<IReadOnlyList<Hall>> GetApprovedHallsPaginatedAsync(
        int skip,
        int take,
        CancellationToken cancellationToken = default)
        => await ApprovedHallsQuery()
            .OrderByDescending(hall => hall.CreatedAt)
            .ThenBy(hall => hall.Name)
            .Skip(skip)
            .Take(take)
            .ToListAsync(cancellationToken);

    public async Task<int> GetApprovedHallsCountAsync(CancellationToken cancellationToken = default)
        => await ApprovedHallsQuery()
            .CountAsync(cancellationToken);

    public async Task<IReadOnlyList<Hall>> SearchApprovedHallsAsync(
        string? name,
        HallRegion? region,
        string? area,
        string? detailedAddress,
        DateOnly? date,
        TimeOnly? startTime,
        int skip,
        int take,
        CancellationToken cancellationToken = default)
        => await ApplySearchFilters(ApprovedHallsQuery(), name, region, area, detailedAddress, date, startTime)
            .OrderByDescending(hall => hall.CreatedAt)
            .ThenBy(hall => hall.Name)
            .Skip(skip)
            .Take(take)
            .ToListAsync(cancellationToken);

    public async Task<int> SearchApprovedHallsCountAsync(
        string? name,
        HallRegion? region,
        string? area,
        string? detailedAddress,
        DateOnly? date,
        TimeOnly? startTime,
        CancellationToken cancellationToken = default)
        => await ApplySearchFilters(ApprovedHallsQuery(), name, region, area, detailedAddress, date, startTime)
            .CountAsync(cancellationToken);

    public async Task<IReadOnlyList<HallImage>> GetHallImagesAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
        => await _context.HallImages
            .AsNoTracking()
            .Where(image => image.HallId == hallId && !image.IsDeleted)
            .OrderBy(image => image.DisplayOrder)
            .ThenBy(image => image.CreatedAt)
            .ToListAsync(cancellationToken);

    private IQueryable<Hall> ApprovedHallsQuery()
        => _context.Halls
            .AsNoTracking()
            .Where(hall => hall.Status == HallStatus.Approved
                && !hall.IsDeleted
                && !hall.IsAdminLocked
                && !hall.SystemLocked
                && hall.PaymentStatus == HallPaymentStatus.Paid);

    private IQueryable<Hall> ApplySearchFilters(
        IQueryable<Hall> query,
        string? name,
        HallRegion? region,
        string? area,
        string? detailedAddress,
        DateOnly? date,
        TimeOnly? startTime)
    {
        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(hall => hall.Name.Contains(name));
        }

        if (region.HasValue)
        {
            query = query.Where(hall => hall.Region == region.Value);
        }

        if (!string.IsNullOrWhiteSpace(area))
        {
            query = query.Where(hall => hall.Address.Contains(area));
        }

        if (!string.IsNullOrWhiteSpace(detailedAddress))
        {
            // WESAL-TASK-7, Edit 7: the owner's own free-text DetailedAddress — the landmark
            // or directions they type — is the third location field, and is filterable in its
            // own right.
            //
            // Deliberately a separate parameter rather than folded into `area`: folding it in
            // would silently widen the meaning of a supplied area from "matches the
            // list-backed Address" to "matches this free text too", changing shipped behaviour
            // for every existing caller.
            //
            // Uses the same partial-match idiom, and therefore the same case behaviour, as the
            // Name and Address filters above: matching is left to the database collation rather
            // than forcing ToLower, which would be inconsistent with the shipped filters and
            // would make the predicate non-sargable. The column carries no index today, exactly
            // like Address, so this introduces no new indexing requirement.
            // hall.DetailedAddress is a nullable column, so it is matched explicitly rather
            // than dereferenced: a hall whose owner left the field empty simply does not match
            // a detailed-address search, which is the same outcome EF would produce for a
            // null-propagating comparison.
            query = query.Where(hall => hall.DetailedAddress != null
                && hall.DetailedAddress.Contains(detailedAddress));
        }

        if (date.HasValue)
        {
            var selectedDate = date.Value;

            // WESAL-TASK-1 hardening: a day the owner blocked is unbookable in its
            // entirety, so the hall must never be offered for it. This is evaluated
            // whenever a date is supplied, not only when an hour is, because a whole-day
            // block makes every hour on that day unbookable. Deliberately independent of
            // ShowBookedSlots: search either lists the hall or omits it, and a hidden
            // blocked day must be omitted just like a hidden fully-booked one - the seeker
            // is never told why.
            query = query.Where(hall => !_context.HallDayAvailabilities.Any(day =>
                day.HallId == hall.Id
                && day.Date == selectedDate
                && !day.IsOpen));
        }

        if (date.HasValue && startTime.HasValue)
        {
            var selectedDate = date.Value;
            var selectedStart = startTime.Value;

            // A seeker asking for a concrete hour must not be offered a hall whose slot is
            // already taken. Independent of ShowBookedSlots for the same reason as the day
            // gate above: a booked hour is simply unavailable, and the seeker is never
            // told whether it is hidden or disclosed.
            //
            // WESAL-TASK-8 (Edit 8): a Reserved hour - held by a live request whose deposit
            // is not confirmed yet - is equally unbookable, so it must be excluded too.
            // Offering the hall here would only lead the seeker to a conflict at booking
            // time, and the availability calendar would disagree with the booking result.
            query = query.Where(hall => !_context.HallSlotAvailabilities.Any(slot =>
                slot.HallId == hall.Id
                && slot.Date == selectedDate
                && slot.StartTime == selectedStart
                && slot.Status != HallSlotStatus.Available));
        }

        return query;
    }

    public async Task<IReadOnlyList<HallFeature>> GetHallFeaturesAsync(
        IReadOnlyCollection<Guid> hallIds,
        CancellationToken cancellationToken = default)
    {
        if (hallIds.Count == 0)
        {
            return [];
        }

        return await _context.HallFeatures
            .AsNoTracking()
            .Where(feature => hallIds.Contains(feature.HallId))
            .OrderBy(feature => feature.HallId)
            .ThenBy(feature => feature.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<HallSlotAvailability>> GetSlotAvailabilitiesAsync(
        IReadOnlyCollection<Guid> hallIds,
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken = default)
    {
        if (hallIds.Count == 0)
        {
            return [];
        }

        return await _context.HallSlotAvailabilities
            .AsNoTracking()
            .Where(availability =>
                hallIds.Contains(availability.HallId)
                && availability.Date >= fromDate
                && availability.Date <= toDate)
            .OrderBy(availability => availability.HallId)
            .ThenBy(availability => availability.Date)
            .ThenBy(availability => availability.StartTime)
            .ToListAsync(cancellationToken);
    }

    /// <summary>
    /// WESAL-TASK-1 hardening: returns the subset of <paramref name="hallIds"/> that the
    /// owner has blocked for at least one day inside the requested range.
    ///
    /// The day gate (<see cref="HallDayAvailability"/>) is authoritative for the whole
    /// hall, so any seeker-facing read that works purely off the hourly slot set has to
    /// consult this as well - otherwise a blocked day still looks bookable.
    ///
    /// Note this intentionally reports the blocked fact without consulting
    /// <see cref="Hall.ShowBookedSlots"/>: deciding whether to disclose the block or hide
    /// it is the caller's job, because the owner view must always see the truth while a
    /// seeker view must honour the toggle.
    /// </summary>
    public async Task<IReadOnlySet<Guid>> GetBlockedDayHallIdsAsync(
        IReadOnlyCollection<Guid> hallIds,
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken = default)
    {
        if (hallIds.Count == 0)
        {
            return new HashSet<Guid>();
        }

        var blockedHallIds = await _context.HallDayAvailabilities
            .AsNoTracking()
            .Where(day =>
                hallIds.Contains(day.HallId)
                && day.Date >= fromDate
                && day.Date <= toDate
                && !day.IsOpen)
            .Select(day => day.HallId)
            .Distinct()
            .ToListAsync(cancellationToken);

        return blockedHallIds.ToHashSet();
    }

    /// <summary>
    /// WESAL-TASK-1 hardening: the specific dates the owner blocked for one hall within the
    /// range. Used by the hall-details availability window, which projects individual days.
    /// </summary>
    public async Task<IReadOnlySet<DateOnly>> GetBlockedDatesAsync(
        Guid hallId,
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken = default)
    {
        var blockedDates = await _context.HallDayAvailabilities
            .AsNoTracking()
            .Where(day =>
                day.HallId == hallId
                && day.Date >= fromDate
                && day.Date <= toDate
                && !day.IsOpen)
            .Select(day => day.Date)
            .Distinct()
            .ToListAsync(cancellationToken);

        return blockedDates.ToHashSet();
    }
}