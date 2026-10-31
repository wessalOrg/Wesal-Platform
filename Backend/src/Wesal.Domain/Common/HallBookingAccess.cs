using Wesal.Domain.Constants;

namespace Wesal.Domain.Common;

/// <summary>
/// Who may use the seeker side of the hall flow: browse halls, read availability,
/// submit and manage their own booking requests (WESAL specification §4.2).
///
/// Booking is a normal platform capability, deliberately independent of the
/// account-approval state. An Event Coordinator or Photographer keeps the same
/// browsing and booking rights as an ordinary Hall Seeker while their account is
/// Pending, Rejected, or Needs Changes; approval only gates publishing
/// (posts and offers), never booking.
///
/// Hall Owners and Admins are not seekers here. A Hall Owner must not book a hall
/// through this flow, and an admin account without an ordinary seeker role keeps
/// the historical behaviour of being refused.
/// </summary>
public static class HallBookingAccess
{
    /// <summary>
    /// Roles that act as a seeker for the hall-booking flow. This mirrors the roles
    /// the registration flow assigns to ordinary users and to the two professional
    /// account types (each account carries exactly one of these roles).
    /// </summary>
    public static readonly IReadOnlyList<string> SeekerRoles =
    [
        ApplicationRoles.RegisteredUser,
        ApplicationRoles.EventCoordinator,
        ApplicationRoles.Photographer
    ];

    /// <summary>
    /// The refusal for an authenticated account that cannot act as a seeker. Kept in
    /// one place so the booking and cancellation services explain the rule identically.
    /// </summary>
    public const string SeekerRoleRequiredMessage =
        "Only regular users, event coordinators, and photographers can submit booking requests.";

    /// <summary>
    /// The refusal for an authenticated account that cannot cancel a booking request.
    /// </summary>
    public const string CancellationRoleRequiredMessage =
        "Only the regular user, event coordinator, or photographer who submitted the booking request can cancel it.";

    /// <summary>
    /// True when the authenticated roles permit the seeker/booking flow. Approval
    /// status is intentionally not part of this decision.
    /// </summary>
    public static bool IsSeeker(IReadOnlyList<string> roles)
    {
        if (roles.Contains(ApplicationRoles.HallOwner, StringComparer.OrdinalIgnoreCase))
        {
            return false;
        }

        return roles.Any(role => SeekerRoles.Contains(role, StringComparer.OrdinalIgnoreCase));
    }
}
