using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

/// <summary>
/// EF Core access for Event Coordinator setup submissions (WESAL coordinator setup).
/// Rows are added without saving: the setup service commits the profile, the durable
/// notification, and the account flags together through the unit of work's transaction.
/// </summary>
public sealed class CoordinatorRepository : ICoordinatorRepository
{
    private readonly ApplicationDbContext _context;

    public CoordinatorRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<bool> ExistsForUserAsync(string userId, CancellationToken cancellationToken = default)
        => _context.CoordinatorProfiles
            .AsNoTracking()
            .AnyAsync(profile => profile.UserId == userId, cancellationToken);

    public async Task AddAsync(CoordinatorProfile profile, CancellationToken cancellationToken = default)
        => await _context.CoordinatorProfiles.AddAsync(profile, cancellationToken);

    public Task<CoordinatorProfile?> GetByUserIdAsync(string userId, CancellationToken cancellationToken = default)
        => _context.CoordinatorProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(profile => profile.UserId == userId, cancellationToken);
}
