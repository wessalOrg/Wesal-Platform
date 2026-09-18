using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;

namespace Wesal.Domain.Common;

/// <summary>
/// Resource-level authorization policy for hall management (US-ADMIN-05/07/09,
/// FR-SUB-01/03/05). The controller-level role policies only determine WHO may call a
/// hall's management endpoints; this guard decides WHETHER a specific hall's
/// management features may be used right now, and is enforced inside every owner and
/// booking-management service once the hall has been resolved and ownership verified.
///
/// Access is a strict conjunction of three independent flags:
/// <list type="bullet">
///   <item>No manual Admin lock (<see cref="Hall.IsAdminLocked"/> — FR-SUB-05);</item>
///   <item>Payment confirmed (<see cref="Hall.PaymentStatus"/> == Paid — FR-SUB-01);</item>
///   <item>No automatic system lock (<see cref="Hall.SystemLocked"/> — FR-SUB-03).</item>
/// </list>
/// The Admin lock dominates the payment state exactly as the subscription status does
/// (see HallSubscriptionService). Each denial surfaces a distinct business-rule code so
/// the frontend can render the correct locked message instead of a generic 403.
/// </summary>
public static class HallManagementAccess
{
    public const string HallLockedCode = "HallLocked";
    public const string PaymentRequiredCode = "PaymentRequired";
    public const string HallSystemLockedCode = "HallSystemLocked";

    /// <summary>
    /// Ensures the authenticated user may manage the given hall. Throws a
    /// <see cref="BusinessRuleException"/> carrying a distinct code when the hall is
    /// Admin locked, unpaid, or system locked.
    /// </summary>
    public static void EnsureAllowed(Hall hall)
    {
        if (hall.IsAdminLocked)
        {
            throw new BusinessRuleException(
                HallLockedCode,
                "This hall has been locked by an administrator and its management features are currently unavailable.");
        }

        if (hall.PaymentStatus != HallPaymentStatus.Paid)
        {
            throw new BusinessRuleException(
                PaymentRequiredCode,
                "Subscription payment is required before this hall can be managed. Please confirm your subscription payment.");
        }

        if (hall.SystemLocked)
        {
            throw new BusinessRuleException(
                HallSystemLockedCode,
                "This hall's subscription cycle has ended without a confirmed renewal and has been automatically locked.");
        }
    }

    /// <summary>
    /// Ensures a hall is still able to accept new booking requests at submission time
    /// (FR-BOOK-01, US-ADMIN-05). A locked hall (Admin lock or system lock) must not
    /// receive new booking requests. Payment state is intentionally NOT evaluated here:
    /// the seeker-facing booking submission is gated on lock state only, while the
    /// payment gate (US-ADMIN-07) governs the owner's management access.
    /// </summary>
    public static void EnsureAcceptingBookings(Hall hall)
    {
        if (hall.IsAdminLocked)
        {
            throw new BusinessRuleException(
                HallLockedCode,
                "This hall is currently locked and cannot accept new booking requests.");
        }

        if (hall.SystemLocked)
        {
            throw new BusinessRuleException(
                HallSystemLockedCode,
                "This hall is currently locked and cannot accept new booking requests.");
        }
    }
}