using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public sealed class OwnerDashboardRepository : IOwnerDashboardRepository
{
    private readonly ApplicationDbContext _context;

    public OwnerDashboardRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<int> GetHallCountByOwnerAsync(string ownerId, CancellationToken cancellationToken = default)
        => _context.Halls
            .AsNoTracking()
            .CountAsync(hall => hall.OwnerId == ownerId && !hall.IsDeleted, cancellationToken);

    public async Task<IReadOnlyList<Hall>> GetOwnedHallsAsync(
        string ownerId,
        CancellationToken cancellationToken = default)
        => await _context.Halls
            .AsNoTracking()
            .Where(hall => hall.OwnerId == ownerId && !hall.IsDeleted)
            .OrderByDescending(hall => hall.CreatedAt)
            .ThenBy(hall => hall.Name)
            .ToListAsync(cancellationToken);

    public Task<Hall?> GetOwnedHallWithDetailsAsync(
        Guid hallId,
        string ownerId,
        CancellationToken cancellationToken = default)
        => OwnedHallsQuery(ownerId)
            .Include(hall => hall.BookingPeriods)
            .Include(hall => hall.Images)
            .FirstOrDefaultAsync(hall => hall.Id == hallId, cancellationToken);

    public Task<Hall?> GetOwnedHallForUpdateAsync(
        Guid hallId,
        string ownerId,
        CancellationToken cancellationToken = default)
        => _context.Halls
            .Include(hall => hall.BookingPeriods)
            .Include(hall => hall.Images)
            .FirstOrDefaultAsync(
                hall => hall.Id == hallId && hall.OwnerId == ownerId && !hall.IsDeleted,
                cancellationToken);

    public void AddHallImages(IEnumerable<HallImage> images)
        => _context.HallImages.AddRange(images);

    public void AddHallBookingPeriod(HallBookingPeriod period)
        => _context.HallBookingPeriods.Add(period);

    public Task<Hall?> GetOwnedHallAsync(
        Guid hallId,
        string ownerId,
        CancellationToken cancellationToken = default)
        => _context.Halls
            .AsNoTracking()
            .FirstOrDefaultAsync(
                hall => hall.Id == hallId && hall.OwnerId == ownerId && !hall.IsDeleted,
                cancellationToken);

    public async Task<IReadOnlyList<OwnerBookingRequestDto>?> GetBookingRequestsAsync(
        Guid hallId,
        string ownerId,
        CancellationToken cancellationToken = default)
    {
        // Ownership is enforced here exactly like the other owned-hall reads: a caller
        // can never see another owner's hall, and the requester name is resolved from
        // the persisted user profile server-side (never from client input).
        var belongsToOwner = await _context.Halls
            .AsNoTracking()
            .AnyAsync(hall =>
                hall.Id == hallId
                && hall.OwnerId == ownerId
                && !hall.IsDeleted,
                cancellationToken);

        if (!belongsToOwner)
        {
            return null;
        }

        return await (
            from booking in _context.Bookings.AsNoTracking()
            join requester in _context.Users.AsNoTracking()
                on booking.RequesterUserId equals requester.Id
            where booking.HallId == hallId
                && booking.Status == BookingStatus.Pending
            orderby booking.Date, booking.Period, booking.CreatedAt, booking.Id
            select new OwnerBookingRequestDto
            {
                BookingRequestId = booking.Id,
                HallId = booking.HallId,
                RequestedDate = booking.Date,
                RequestedPeriod = booking.Period,
                RequesterUserId = booking.RequesterUserId,
                RequesterName = requester.FullName,
                Status = booking.Status,
                RequestedAt = booking.CreatedAt
            })
            .ToListAsync(cancellationToken);
    }

    private IQueryable<Hall> OwnedHallsQuery(string ownerId)
        => _context.Halls
            .AsNoTracking()
            .Where(hall => hall.OwnerId == ownerId && !hall.IsDeleted);
}