using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

/// <summary>
/// EF Core access for Photographer setup submissions (WESAL photographer setup).
/// Rows are added without saving: the setup service commits the profile, the durable
/// notification, and the account flags together through the unit of work's transaction.
/// </summary>
public sealed class PhotographerRepository : IPhotographerRepository
{
    private readonly ApplicationDbContext _context;

    public PhotographerRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<bool> ExistsForUserAsync(string userId, CancellationToken cancellationToken = default)
        => _context.PhotographerProfiles
            .AsNoTracking()
            .AnyAsync(profile => profile.UserId == userId, cancellationToken);

    public async Task AddAsync(PhotographerProfile profile, CancellationToken cancellationToken = default)
        => await _context.PhotographerProfiles.AddAsync(profile, cancellationToken);

    public Task<PhotographerProfile?> GetByUserIdAsync(string userId, CancellationToken cancellationToken = default)
        => _context.PhotographerProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(profile => profile.UserId == userId, cancellationToken);
}
