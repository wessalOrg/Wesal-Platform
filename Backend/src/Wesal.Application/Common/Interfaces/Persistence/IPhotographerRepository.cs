using Wesal.Domain.Entities;

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
}
