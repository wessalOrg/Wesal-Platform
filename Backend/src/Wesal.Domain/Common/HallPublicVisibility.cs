using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;

namespace Wesal.Domain.Common;

/// <summary>
/// Single source of truth for whether a hall's data may be exposed to the public
/// (seeker-facing) surface. The public hall-details endpoint and the public hourly
/// availability endpoints must agree exactly: a hall that is hidden from one must be
/// hidden from all of them, otherwise a soft-deleted or unapproved hall's schedule stays
/// readable by anyone who knows or guesses its id.
///
/// A hall is publicly visible only when it is a real, live, bookable listing:
/// <list type="bullet">
///   <item>it exists and is not soft-deleted (<see cref="Hall.IsDeleted"/>);</item>
///   <item>it has been approved by an admin (<see cref="Hall.Status"/> == Approved);</item>
///   <item>it carries no manual admin lock (<see cref="Hall.IsAdminLocked"/>);</item>
///   <item>it carries no automatic system lock (<see cref="Hall.SystemLocked"/>);</item>
///   <item>its subscription payment is confirmed (<see cref="Hall.PaymentStatus"/> == Paid).</item>
///   </list>
///
/// This is deliberately separate from <see cref="HallManagementAccess"/>, which governs
/// the owner's management surface and throws distinct business-rule codes. Owner-facing
/// endpoints must never call this guard: they do not filter on <see cref="Hall.Status"/>,
/// so an owner keeps managing a hall that is still pending or rejected. Soft-deleted
/// halls are already hidden from the owner surface by the pre-existing
/// <c>!IsDeleted</c> filter in the owner dashboard repository, and this guard is
/// deliberately not applied there either, so it leaves that behaviour untouched.
/// </summary>
public static class HallPublicVisibility
{
    /// <summary>
    /// True only when the hall may be exposed to the public seeker surface. A null hall
    /// (not found) is never publicly visible.
    /// </summary>
    public static bool IsPubliclyVisible(Hall? hall)
        => hall is not null
           && !hall.IsDeleted
           && hall.Status == HallStatus.Approved
           && !hall.IsAdminLocked
           && !hall.SystemLocked
           && hall.PaymentStatus == HallPaymentStatus.Paid;

    /// <summary>
    /// Returns the hall when it is publicly visible, otherwise throws the same
    /// <see cref="NotFoundException"/> the public hall-details endpoint throws, so every
    /// hidden-hall response shares one error shape (404) rather than leaking a
    /// "this hall exists but is not available" signal.
    /// </summary>
    public static Hall EnsurePubliclyVisible(Hall? hall, Guid hallId)
    {
        if (!IsPubliclyVisible(hall))
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        return hall!;
    }
}
