using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Publishes an accepted booking's booked period as Booked (US-OWNER-13,
/// FR-BOOK-06). Ownership and status eligibility are verified exclusively from
/// the authenticated JWT session and the persisted booking/hall records; the
/// caller can never supply a trusted owner identity from the client.
///
/// Publishing is an owner action that can only be performed on a booking in the
/// Accepted state that has not already been published. A mandatory, final,
/// server-side availability re-check is performed at publication time: the exact
/// HallAvailability period (hall, date, period) must still be claimable by this
/// booking alone — if any other active (Pending or Accepted) booking claims the
/// same period, publication is rejected with a ConflictException. On success the
/// exact period is guaranteed to be marked Booked (reserved where missing) and
/// the booking is marked published. Only the booking's own requested period is
/// ever touched; all other periods, dates, and bookings are left untouched.
///
/// The whole operation runs inside a single database transaction. Race conditions
/// between concurrent publication attempts are resolved at the database level via
/// an atomic conditional UPDATE (PublishAcceptedAsync): exactly one attempt wins
/// per booking, and the loser surfaces as a ConflictException without side effects.
/// </summary>
public interface IBookingPublishingService
{
    /// <summary>
    /// Publishes an accepted booking's period as Booked. Throws
    /// UnauthorizedException when no valid owner session is present,
    /// ForbiddenException when the caller is not a Hall Owner or does not own the
    /// hall, NotFoundException when the booking or hall is not found, and
    /// ConflictException when the booking is not Accepted, is already published,
    /// another active booking claims the same period, or a concurrent publication
    /// already won.
    /// </summary>
    Task<PublishBookingResultDto> PublishBookingAsync(
        Guid hallId,
        Guid bookingId,
        CancellationToken cancellationToken = default);
}