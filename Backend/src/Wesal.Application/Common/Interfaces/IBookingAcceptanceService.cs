using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Accepts a pending booking request on behalf of the authenticated Hall Owner
/// (US-OWNER-11, FR-BOOK-01). Ownership and status eligibility are verified
/// exclusively from the authenticated JWT session and the persisted booking/hall
/// records; the caller can never supply a trusted owner identity from the client.
///
/// Acceptance transitions the booking from Pending to Accepted (the
/// deposit-confirmation-pending state in this model). The requested period(s)
/// remain protected (reserved) so that no competing booking can take them;
/// the period is NOT permanently marked as Booked because the deposit workflow
/// (US-BOOK-05) is not yet implemented.
///
/// The accept-vs-cancel race is resolved at the database level via an atomic
/// conditional UPDATE: exactly one of AcceptPendingAsync / CancelPendingAsync
/// succeeds per row. A lost race surfaces as a ConflictException.
/// </summary>
public interface IBookingAcceptanceService
{
    /// <summary>
    /// Accepts a pending booking request. Throws UnauthorizedException when no
    /// valid owner session is present, ForbiddenException when the caller is not
    /// a Hall Owner or does not own the hall, NotFoundException when the booking
    /// or hall is not found, and ConflictException when the booking has already
    /// been accepted, rejected, or cancelled.
    /// </summary>
    Task<AcceptBookingResultDto> AcceptBookingAsync(
        Guid hallId,
        Guid bookingId,
        CancellationToken cancellationToken = default);
}
