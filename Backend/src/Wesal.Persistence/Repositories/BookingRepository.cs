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
}