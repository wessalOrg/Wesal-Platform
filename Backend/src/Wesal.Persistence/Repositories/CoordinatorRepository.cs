using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
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

    /// <summary>
    /// WESAL Task 5, requirement 5.1. Inner join with the account: a profile row without a
    /// surviving account is not a request anybody can review, and the status filter lives
    /// on the account rather than the profile, so both come from one read. Ties on
    /// SubmittedAt break on UserId so paging can never repeat or skip a row.
    /// </summary>
    public async Task<IReadOnlyList<AdminCoordinatorRequestDto>> GetRequestsAsync(
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

    private IQueryable<AdminCoordinatorRequestDto> QueryRequests(AccountApprovalStatus? status)
    {
        var requestedStatus = status;

        return from profile in _context.CoordinatorProfiles.AsNoTracking()
               join user in _context.Users.AsNoTracking() on profile.UserId equals user.Id
               where requestedStatus == null || user.ApprovalStatus == requestedStatus
               select new AdminCoordinatorRequestDto
               {
                   UserId = user.Id,
                   FullName = user.FullName,
                   Email = user.Email ?? string.Empty,
                   ApprovalStatus = user.ApprovalStatus,
                   BusinessType = profile.BusinessType,
                   DisplayName = profile.BusinessType == CoordinatorBusinessType.Shop
                       ? profile.ShopName
                       : profile.OnlineStoreName,
                   SubmittedAt = profile.SubmittedAt
               };
    }

    public Task UpdateAsync(CoordinatorProfile profile, CancellationToken cancellationToken = default)
    {
        var tracked = _context.CoordinatorProfiles.Local.FirstOrDefault(item => item.UserId == profile.UserId);
        if (tracked is not null)
            _context.Entry(tracked).CurrentValues.SetValues(profile);
        else
            _context.CoordinatorProfiles.Update(profile);
        return Task.CompletedTask;
    }
}
