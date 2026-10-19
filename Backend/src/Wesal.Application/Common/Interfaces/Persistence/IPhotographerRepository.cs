using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Interfaces.Persistence;

/// <summary>
/// Persistence access for Photographer setup submissions (WESAL photographer setup).
/// </summary>
public interface IPhotographerRepository
{
    /// <summary>True when the user already has a setup submission (duplicate guard).</summary>
    Task<bool> ExistsForUserAsync(string userId, CancellationToken cancellationToken = default);

    Task AddAsync(PhotographerProfile profile, CancellationToken cancellationToken = default);

    Task<PhotographerProfile?> GetByUserIdAsync(string userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// The administrator's request queue (WESAL Task 6, requirement 6.1): one row per
    /// submitted setup, joined with its account so the status filter and the identity
    /// columns come from the same read. Newest submission first with a deterministic
    /// tie-break, already paged by the caller. A null status means "every status".
    /// </summary>
    Task<IReadOnlyList<AdminPhotographerRequestDto>> GetRequestsAsync(
        AccountApprovalStatus? status,
        int skip,
        int take,
        CancellationToken cancellationToken = default);

    /// <summary>The total rows <see cref="GetRequestsAsync"/> would return, for paging.</summary>
    Task<int> CountRequestsAsync(AccountApprovalStatus? status, CancellationToken cancellationToken = default);
    Task UpdateAsync(PhotographerProfile profile, CancellationToken cancellationToken = default);
}
