using Wesal.Domain.Common;
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
            .Include(hall => hall.Images)
            .Include(hall => hall.Features)
            .FirstOrDefaultAsync(hall => hall.Id == hallId, cancellationToken);

    public Task<Hall?> GetOwnedHallForUpdateAsync(
        Guid hallId,
        string ownerId,
        CancellationToken cancellationToken = default)
        => _context.Halls
            .Include(hall => hall.Images)
            .Include(hall => hall.Features)
            .FirstOrDefaultAsync(
                hall => hall.Id == hallId && hall.OwnerId == ownerId && !hall.IsDeleted,
                cancellationToken);

    public void AddHallImages(IEnumerable<HallImage> images)
        => _context.HallImages.AddRange(images);

    public void AddHallFeatures(IEnumerable<HallFeature> features)
        => _context.HallFeatures.AddRange(features);

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

        // WESAL-TASK-8 (Edit 8): the owner acts on two kinds of live request, so both must
        // be listed. Pending needs a review decision, and Accepted needs the payment
        // confirmation that officially books it. Filtering to Pending alone would hide an
        // approved request the moment it was approved, leaving the owner no way to confirm
        // the deposit they asked for and stranding the booking's held hours.
        var open = await (
            from booking in _context.Bookings
                .AsNoTracking()
                .Where(BookingActivity.Active)
                .Include(booking => booking.ExternalDetails)
                .Include(booking => booking.Slots)
            join requester in _context.Users.AsNoTracking()
                on booking.RequesterUserId equals requester.Id into requesters
            from requester in requesters.DefaultIfEmpty()
            where booking.HallId == hallId
            orderby booking.Date, booking.CreatedAt, booking.Id
            select new
            {
                Booking = booking,
                RequesterName = requester == null ? "" : requester.FullName,
                ProfilePhone = requester == null ? null : requester.PhoneNumber,
                ProfilePictureUrl = requester == null ? null : requester.ProfilePictureUrl
            })
            .ToListAsync(cancellationToken);

        return open
            .Select(row => new OwnerBookingRequestDto
            {
                BookingRequestId = row.Booking.Id,
                HallId = row.Booking.HallId,
                RequestedDate = row.Booking.Date,
                SlotStarts = row.Booking.Slots
                    .OrderBy(slot => slot.StartTime)
                    .Select(slot => slot.StartTime)
                    .ToList(),
                TimeRange = row.Booking.HourlyTimeRange,
                RequesterUserId = row.Booking.RequesterUserId ?? "",
                Source = row.Booking.Source,
                Revision = row.Booking.Revision,
                ExternalEventType = row.Booking.ExternalDetails?.EventType,
                RequesterName = row.Booking.ExternalDetails?.CustomerName ?? ResolveRequesterDisplayName(row.Booking.NameOnBooking, row.RequesterName),
                NameOnBooking = string.IsNullOrWhiteSpace(row.Booking.NameOnBooking)
                    ? null
                    : row.Booking.NameOnBooking.Trim(),
                RequesterPhone = row.Booking.ExternalDetails?.Phone ?? ResolveRequesterPhone(row.Booking.NameOnBooking, row.ProfilePhone),
                RequesterAvatarUrl = string.IsNullOrWhiteSpace(row.ProfilePictureUrl)
                    ? null
                    : row.ProfilePictureUrl.Trim(),
                Status = row.Booking.Status,
                RequestedAt = row.Booking.CreatedAt,
                DepositAmount = row.Booking.DepositAmount,
                DepositPaymentConfirmedAt = row.Booking.DepositPaymentConfirmedAt
            })
            .ToList();
    }

    /// <summary>
    /// Prefer the name the seeker typed into NameOnBooking (before " · " event and
    /// " - " phone packing), then the account full name.
    /// </summary>
    private static string ResolveRequesterDisplayName(string? nameOnBooking, string profileFullName)
    {
        var fromBooking = ExtractDisplayName(nameOnBooking);
        if (!string.IsNullOrWhiteSpace(fromBooking))
        {
            return fromBooking;
        }

        return string.IsNullOrWhiteSpace(profileFullName) ? string.Empty : profileFullName.Trim();
    }

    /// <summary>
    /// Prefer the phone the seeker typed into the booking name (suffix after " - "),
    /// then the account phone on the user profile.
    /// </summary>
    private static string ResolveRequesterPhone(string? nameOnBooking, string? profilePhone)
    {
        var fromBooking = ExtractPhoneSuffix(nameOnBooking);
        if (!string.IsNullOrWhiteSpace(fromBooking))
        {
            return fromBooking;
        }

        return string.IsNullOrWhiteSpace(profilePhone) ? string.Empty : profilePhone.Trim();
    }

    private static string? ExtractDisplayName(string? nameOnBooking)
    {
        if (string.IsNullOrWhiteSpace(nameOnBooking))
        {
            return null;
        }

        var value = nameOnBooking.Trim();
        var phoneSep = value.LastIndexOf(" - ", StringComparison.Ordinal);
        if (phoneSep >= 0)
        {
            var candidate = value[(phoneSep + 3)..].Trim();
            if (candidate.Length >= 7 && candidate.Any(char.IsDigit))
            {
                value = value[..phoneSep].Trim();
            }
        }

        var eventSep = value.IndexOf(" · ", StringComparison.Ordinal);
        if (eventSep >= 0)
        {
            value = value[..eventSep].Trim();
        }

        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    private static string? ExtractPhoneSuffix(string? nameOnBooking)
    {
        if (string.IsNullOrWhiteSpace(nameOnBooking))
        {
            return null;
        }

        var separator = nameOnBooking.LastIndexOf(" - ", StringComparison.Ordinal);
        if (separator < 0)
        {
            return null;
        }

        var candidate = nameOnBooking[(separator + 3)..].Trim();
        if (candidate.Length < 7 || !candidate.Any(char.IsDigit))
        {
            return null;
        }

        return candidate;
    }

    public async Task<IReadOnlyList<Booking>?> GetActiveBookingsInRangeAsync(
        Guid hallId,
        string ownerId,
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken = default)
    {
        // Ownership is enforced here exactly like GetBookingRequestsAsync: a caller
        // can never see another owner's hall.
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

        // Same "active" rule as BookingRepository.HasActiveBookingsOnDayAsync: only a
        // Pending or Accepted booking holds its hours. Cancelled or rejected bookings
        // freed their slots and must not paint the owner's calendar.
        return await _context.Bookings
            .AsNoTracking()
            .Where(BookingActivity.Active)
            .Include(booking => booking.Slots)
            .Where(booking =>
                booking.HallId == hallId
                && booking.Date >= fromDate
                && booking.Date <= toDate)
            .OrderBy(booking => booking.Date)
            .ThenBy(booking => booking.CreatedAt)
            .ThenBy(booking => booking.Id)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Booking>?> GetBookingsForInsightsAsync(Guid? hallId, string ownerId,
        DateTimeOffset fromInclusive, DateTimeOffset toExclusive, CancellationToken cancellationToken = default)
    {
        var halls = _context.Halls.AsNoTracking().Where(hall => hall.OwnerId == ownerId && !hall.IsDeleted);
        if (hallId.HasValue)
        {
            if (!await halls.AnyAsync(hall => hall.Id == hallId.Value, cancellationToken)) return null;
            halls = halls.Where(hall => hall.Id == hallId.Value);
        }
        var hallIds = halls.Select(hall => hall.Id);
        return await _context.Bookings.AsNoTracking()
            .Where(BookingActivity.Active)
            .Include(booking => booking.Slots)
            .Include(booking => booking.ExternalDetails)
            .Where(booking => hallIds.Contains(booking.HallId)
                && booking.CreatedAt >= fromInclusive && booking.CreatedAt < toExclusive)
            .OrderBy(booking => booking.Date).ThenBy(booking => booking.CreatedAt).ThenBy(booking => booking.Id)
            .ToListAsync(cancellationToken);
    }

    private IQueryable<Hall> OwnedHallsQuery(string ownerId)
        => _context.Halls
            .AsNoTracking()
            .Where(hall => hall.OwnerId == ownerId && !hall.IsDeleted);
}
