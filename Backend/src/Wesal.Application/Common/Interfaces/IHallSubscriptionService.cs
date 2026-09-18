using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Returns the live subscription state of a hall owned by the authenticated Hall
/// Owner (US-OWNER-17, FR-HALL-05). Access is restricted to Hall Owners by the
/// RequireHallOwner authorization policy (Wesal.Domain.Constants.ApplicationPolicies).
/// The owner is resolved exclusively from the authenticated session, so a caller can
/// never read another owner's hall. The endpoint is read-only: it never changes
/// payment, approval, or lock state, and never starts a renewal.
/// </summary>
public interface IHallSubscriptionService
{
    /// <summary>
    /// Returns the authenticated owner's hall subscription status (Active / Payment
    /// Pending / Expired / Locked) and its next billing date when one applies. Throws
    /// UnauthorizedException when no valid owner session is present and
    /// NotFoundException when the hall does not exist, is deleted, or belongs to
    /// another owner.
    /// </summary>
    Task<OwnerHallSubscriptionDto> GetHallSubscriptionAsync(
        Guid hallId,
        CancellationToken cancellationToken = default);
}