using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Owner-dashboard visitor statistics across all halls owned by the authenticated
/// Hall Owner (this calendar month vs previous calendar month).
/// </summary>
public interface IOwnerVisitorStatsService
{
    /// <summary>
    /// Records a public hall-details page view. No-ops for deleted or non-visible halls.
    /// Callers should treat failures as non-fatal so hall details still return.
    /// </summary>
    Task RecordHallPageViewAsync(Guid hallId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Aggregates visits, favorites, booking requests, and conversion rates for the
    /// authenticated owner's non-deleted halls.
    /// </summary>
    Task<OwnerVisitorStatsDto> GetVisitorStatsAsync(Guid? hallId = null, CancellationToken cancellationToken = default);
}
