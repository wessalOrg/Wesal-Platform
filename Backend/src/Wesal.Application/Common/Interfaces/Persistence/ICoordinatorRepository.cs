using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

/// <summary>
/// Persistence access for Event Coordinator setup submissions (WESAL coordinator setup).
/// </summary>
public interface ICoordinatorRepository
{
    /// <summary>True when the user already has a setup submission (duplicate guard).</summary>
    Task<bool> ExistsForUserAsync(string userId, CancellationToken cancellationToken = default);

    Task AddAsync(CoordinatorProfile profile, CancellationToken cancellationToken = default);

    Task<CoordinatorProfile?> GetByUserIdAsync(string userId, CancellationToken cancellationToken = default);
}
