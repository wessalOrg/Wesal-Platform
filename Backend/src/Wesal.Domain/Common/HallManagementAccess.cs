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
    /// The single user-facing message returned whenever a manually locked/suspended
    /// hall (or an automatically system-locked hall) refuses a booking, a message,
    /// or an owner-management action (Edit 16). Centralised here so every guard
    /// surfaces the identical wording instead of duplicating lock strings across
    /// controllers and services.
    /// </summary>
    public const string HallUnavailableMessage = "للأسف, هاي الصالة غير متاحة حاليا";

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
                HallUnavailableMessage);
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
    /// Ensures the owner may still EDIT this hall's own data (WESAL-TASK-2+3, Edit 3).
    /// <para>
    /// This is deliberately weaker than <see cref="EnsureAllowed"/>: it keeps the two
    /// authoritative holds (an Admin lock and an automatic subscription-cycle lock) but
    /// drops the payment requirement, so an owner whose subscription has lapsed can still
    /// correct their hall's name, photos, address and description at any time. Paying is a
    /// separate concern, enforced by the booking, availability and subscription paths that
    /// still call <see cref="EnsureAllowed"/>.
    /// </para>
    /// </summary>
    public static void EnsureDataEditable(Hall hall)
    {
        if (hall.IsAdminLocked)
        {
            throw new BusinessRuleException(
                HallLockedCode,
                HallUnavailableMessage);
        }

        if (hall.SystemLocked)
        {
            throw new BusinessRuleException(
                HallSystemLockedCode,
                HallUnavailableMessage);
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
                HallUnavailableMessage);
        }

        if (hall.SystemLocked)
        {
            throw new BusinessRuleException(
                HallSystemLockedCode,
                HallUnavailableMessage);
        }
    }

    /// <summary>
    /// Ensures a user may start or send a hall-specific message concerning the given
    /// hall (Edit 16). A manually locked/suspended hall (or a system-locked one)
    /// refuses new and existing hall threads with the same unavailable message used
    /// for bookings, so seekers cannot probe or contact a suspended listing.
    /// Admins are never blocked: they must still reach the owner about the lock.
    /// Payment state is intentionally NOT evaluated here.
    /// </summary>
    public static void EnsureMessagingAllowed(Hall hall, bool isAdmin)
    {
        if (isAdmin)
        {
            return;
        }

        EnsureAcceptingBookings(hall);
    }
}