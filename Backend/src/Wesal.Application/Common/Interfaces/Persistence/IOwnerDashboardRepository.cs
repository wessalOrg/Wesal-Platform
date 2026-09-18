using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

/// <summary>
/// Read-only data needed by the Hall Owner management interface (US-OWNER-01,
/// US-OWNER-05). Kept separate from <see cref="IHallRepository"/> so the owner
/// dashboard features do not widen the hall repository contract used by existing
/// public features.
/// </summary>
public interface IOwnerDashboardRepository
{
    /// <summary>Counts the non-deleted halls owned by a given user.</summary>
    Task<int> GetHallCountByOwnerAsync(string ownerId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the non-deleted halls owned by a given user. The status of each hall
    /// is read from its persisted record on every call so the owner always sees the
    /// current approval state. Ownership is filtered server-side; the owner id is
    /// never taken from client input.
    /// </summary>
    Task<IReadOnlyList<Hall>> GetOwnedHallsAsync(string ownerId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns a single non-deleted hall owned by a given user together with its
    /// booking periods and photos (US-OWNER-07). Read-only (no tracking); the
    /// caller must not mutate the returned aggregate.
    /// </summary>
    Task<Hall?> GetOwnedHallWithDetailsAsync(
        Guid hallId,
        string ownerId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns a single non-deleted hall owned by a given user together with its
    /// booking periods and photos, tracked so the caller can mutate and persist the
    /// aggregate in a single atomic save (US-OWNER-07, FR-HALL-02).
    /// </summary>
    Task<Hall?> GetOwnedHallForUpdateAsync(
        Guid hallId,
        string ownerId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Registers new photos on a tracked hall aggregate (US-OWNER-07). Nothing is
    /// persisted here; the caller saves atomically through the unit of work so the
    /// whole update commits or rolls back together.
    /// </summary>
    void AddHallImages(IEnumerable<HallImage> images);

    /// <summary>
    /// Registers a new booking period on a tracked hall aggregate (US-OWNER-07).
    /// Nothing is persisted here; the caller saves atomically through the unit of work.
    /// </summary>
    void AddHallBookingPeriod(HallBookingPeriod period);

    /// <summary>
    /// Returns a single non-deleted hall owned by a user together with its
    /// subscription state (US-OWNER-17, FR-HALL-05). Read-only (no tracking); the
    /// caller must not mutate the returned aggregate. Returns <see langword="null"/>
    /// when the hall does not exist, is deleted, or belongs to another user so the
    /// caller can surface a not-found response.
    /// </summary>
    Task<Hall?> GetOwnedHallAsync(
        Guid hallId,
        string ownerId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns the pending booking requests for a non-deleted hall owned by a given
    /// user (US-OWNER-09, FR-BOOK-01). Ownership is filtered server-side, matching
    /// <see cref="GetOwnedHallsAsync"/>: a caller can never read another owner's hall.
    /// Returns <see langword="null"/> when the hall does not exist, is deleted, or
    /// belongs to another user (so the caller can surface a not-found response) and an
    /// empty list when the hall is owned but has no pending requests. Every pending
    /// request is returned with no deduplication, so competing requests for the same
    /// hall/date/period all appear. The requester's display name is resolved server-side
    /// by joining the persisted user profile; no requester identity or name is ever taken
    /// from client input. Result order is deterministic (requested date, then period,
    /// then request creation time, then id).
    /// </summary>
    Task<IReadOnlyList<OwnerBookingRequestDto>?> GetBookingRequestsAsync(
        Guid hallId,
        string ownerId,
        CancellationToken cancellationToken = default);
}