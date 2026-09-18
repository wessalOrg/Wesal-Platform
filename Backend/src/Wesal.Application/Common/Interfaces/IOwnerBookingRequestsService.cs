using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Returns the incoming booking requests for a hall owned by the authenticated Hall
/// Owner (US-OWNER-09, FR-BOOK-01). Access is restricted to Hall Owners by the
/// RequireHallOwner authorization policy (Wesal.Domain.Constants.ApplicationPolicies).
/// The owner is resolved exclusively from the authenticated session, so a caller can
/// never read another owner's hall. Competing requests for the same hall/date/period
/// are all returned — never deduplicated — and this service is strictly read-only:
/// it never approves, rejects, cancels, or otherwise mutates a booking.
/// </summary>
public interface IOwnerBookingRequestsService
{
    /// <summary>
    /// Returns the pending booking requests for a hall owned by the authenticated Hall
    /// Owner. Throws UnauthorizedException when no valid owner session is present and
    /// NotFoundException when the hall does not exist, is deleted, or belongs to
    /// another owner.
    /// </summary>
    Task<IReadOnlyList<OwnerBookingRequestDto>> GetBookingRequestsAsync(
        Guid hallId,
        CancellationToken cancellationToken = default);
}