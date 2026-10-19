using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Returns the booking history of the authenticated Regular User ("My bookings").
/// Access is restricted to authenticated users by the RequireAuthenticatedUser
/// authorization policy (Wesal.Domain.Constants.ApplicationPolicies), and the requester
/// is resolved exclusively from the authenticated session, so a caller can never read
/// another user's bookings. The read is strictly passive: no booking status,
/// availability, or reservation is ever changed.
/// </summary>
public interface IUserBookingsService
{
    /// <summary>
    /// Returns every booking submitted by the authenticated user across all halls, newest
    /// day first. Throws UnauthorizedException when no valid user session is present.
    /// </summary>
    Task<IReadOnlyList<UserBookingDto>> GetMyBookingsAsync(
        CancellationToken cancellationToken = default);
}
