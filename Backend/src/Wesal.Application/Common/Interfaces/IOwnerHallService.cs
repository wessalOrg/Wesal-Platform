using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Retrieves and updates a hall owned by the authenticated Hall Owner (US-OWNER-07,
/// FR-HALL-02). Access is restricted to Hall Owners by the RequireHallOwner
/// authorization policy (Wesal.Domain.Constants.ApplicationPolicies). The owner is
/// resolved exclusively from the authenticated session, so a caller can never read or
/// update another owner's hall, and the owner identity / approval status are preserved
/// server-side and can never be changed by the client.
/// </summary>
public interface IOwnerHallService
{
    /// <summary>
    /// Returns the authenticated owner's hall with its full editable details,
    /// including booking periods and photos.
    /// </summary>
    Task<OwnerHallDetailsDto> GetOwnedHallDetailsAsync(Guid hallId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Atomically applies the requested details to the authenticated owner's hall and
    /// returns the updated details. Editing is rejected while the hall is under Admin
    /// review (PendingReview); the hall's approval status is always preserved.
    /// </summary>
    Task<OwnerHallDetailsDto> UpdateOwnedHallAsync(
        Guid hallId,
        UpdateOwnerHallRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Soft-deletes the authenticated owner's hall (US-OWNER-16). Sets IsDeleted
    /// server-side; historical bookings/messages/conversations are preserved.
    /// Repeated deletion of an already-deleted hall returns NotFound.
    /// </summary>
    Task DeleteOwnedHallAsync(
        Guid hallId,
        CancellationToken cancellationToken = default);
}