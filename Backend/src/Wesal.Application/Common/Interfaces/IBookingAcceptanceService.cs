using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Accepts a pending booking request on behalf of the authenticated Hall Owner
/// (US-OWNER-11, FR-BOOK-01). Ownership and status eligibility are verified
/// exclusively from the authenticated JWT session and the persisted booking/hall
/// records; the caller can never supply a trusted owner identity from the client.
///
/// WESAL-TASK-8 (Edit 8): acceptance requires a deposit and moves the booking from
/// Pending to Accepted, the deposit-pending state. The requested hours stay Reserved so
/// no competing request can take them, and they are NOT marked Booked here: that only
/// happens once the owner confirms the deposit was received (US-BOOK-05). The requester
/// is told how much to pay, on the same requester/owner conversation used for rejection.
///
/// The accept-vs-cancel race is resolved at the database level via an atomic
/// conditional UPDATE: exactly one of AcceptPendingAsync / CancelPendingAsync
/// succeeds per row. A lost race surfaces as a ConflictException.
/// </summary>
public interface IBookingAcceptanceService
{
    /// <summary>
    /// Accepts a pending booking request, persisting the owner's required deposit and
    /// notifying the requester. Throws UnauthorizedException when no valid owner session
    /// is present, ForbiddenException when the caller is not a Hall Owner or does not own
    /// the hall, ValidationException when the deposit is missing or out of range,
    /// NotFoundException when the booking or hall is not found, and ConflictException when
    /// the booking has already been accepted, rejected, or cancelled.
    /// </summary>
    Task<AcceptBookingResultDto> AcceptBookingAsync(
        Guid hallId,
        Guid bookingId,
        AcceptBookingRequestDto request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Retries the delivery of approval notices that were queued after a failed attempt.
    /// Best-effort: returns how many notices were delivered and never throws for a
    /// single failed booking.
    /// </summary>
    Task<int> DeliverPendingAcceptanceNotificationsAsync(
        CancellationToken cancellationToken = default);
}
