using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Supplies the authenticated Hall Owner's own halls with their current approval status
/// (US-OWNER-05). Access is restricted to Hall Owners by the RequireHallOwner
/// authorization policy (Wesal.Domain.Constants.ApplicationPolicies). The owner is
/// resolved exclusively from the authenticated session, and only that owner's halls
/// are ever returned.
/// </summary>
public interface IHallStatusTrackingService
{
    Task<IReadOnlyList<OwnerHallDto>> GetOwnedHallsAsync(CancellationToken cancellationToken = default);
}