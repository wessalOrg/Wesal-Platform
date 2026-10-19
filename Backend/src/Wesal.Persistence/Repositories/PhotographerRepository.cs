using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
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

    /// <summary>
    /// WESAL Task 6, requirement 6.1. Same shape as the coordinator queue: inner join with
    /// the account (the status filter lives there), newest submission first, UserId
    /// tie-break so paging is stable.
    /// </summary>
    public async Task<IReadOnlyList<AdminPhotographerRequestDto>> GetRequestsAsync(
        AccountApprovalStatus? status,
        int skip,
        int take,
        CancellationToken cancellationToken = default)
    {
        var query = QueryRequests(status);

        return await query
            .OrderByDescending(row => row.SubmittedAt)
            .ThenBy(row => row.UserId)
            .Skip(skip)
            .Take(take)
            .ToListAsync(cancellationToken);
    }

    public async Task<int> CountRequestsAsync(AccountApprovalStatus? status, CancellationToken cancellationToken = default)
        => await QueryRequests(status).CountAsync(cancellationToken);

    private IQueryable<AdminPhotographerRequestDto> QueryRequests(AccountApprovalStatus? status)
    {
        var requestedStatus = status;

        return from profile in _context.PhotographerProfiles.AsNoTracking()
               join user in _context.Users.AsNoTracking() on profile.UserId equals user.Id
               where requestedStatus == null || user.ApprovalStatus == requestedStatus
               select new AdminPhotographerRequestDto
               {
                   UserId = user.Id,
                   FullName = user.FullName,
                   Email = user.Email ?? string.Empty,
                   ApprovalStatus = user.ApprovalStatus,
                   HasStudio = profile.HasStudio,
                   DisplayName = profile.StudioName,
                   SubmittedAt = profile.SubmittedAt
               };
    }
}
