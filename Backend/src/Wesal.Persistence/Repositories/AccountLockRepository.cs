using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public sealed class AccountLockRepository(ApplicationDbContext context) : IAccountLockRepository
{
    public async Task AcquireUserLockAsync(string userId, CancellationToken cancellationToken = default)
    {
        if (context.Database.ProviderName?.Contains("Npgsql", StringComparison.Ordinal) == true)
            await context.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtext({"account-lock:" + userId}))", cancellationToken);
    }

    public Task<DateTimeOffset?> GetActiveEndsAtAsync(string userId, DateTimeOffset now, CancellationToken cancellationToken = default)
        => context.AccountLocks.AsNoTracking().Where(row => row.UserId == userId && row.LiftedAt == null
                && row.StartsAt <= now && row.EndsAt > now)
            .OrderByDescending(row => row.EndsAt).Select(row => (DateTimeOffset?)row.EndsAt).FirstOrDefaultAsync(cancellationToken);

    public Task<UserPublishingRestriction?> GetActiveAsync(string userId, DateTimeOffset now, CancellationToken cancellationToken = default)
        => context.AccountLocks.AsNoTracking().Where(row => row.UserId == userId && row.LiftedAt == null
                && row.StartsAt <= now && row.EndsAt > now)
            .OrderByDescending(row => row.EndsAt).FirstOrDefaultAsync(cancellationToken);

    public Task<UserPublishingRestriction?> GetCurrentAsync(string userId, DateTimeOffset now, CancellationToken cancellationToken = default)
        => context.AccountLocks.AsNoTracking().Where(row => row.UserId == userId && row.LiftedAt == null
                && row.StartsAt <= now && row.EndsAt > now)
            .OrderByDescending(row => row.CreatedAt).FirstOrDefaultAsync(cancellationToken);

    public Task<UserPublishingRestriction?> GetActiveForUpdateAsync(string userId, DateTimeOffset now, CancellationToken cancellationToken = default)
        => context.AccountLocks.Where(row => row.UserId == userId && row.LiftedAt == null
                && row.StartsAt <= now && row.EndsAt > now)
            .OrderByDescending(row => row.CreatedAt).FirstOrDefaultAsync(cancellationToken);

    public async Task AddAsync(UserPublishingRestriction restriction, CancellationToken cancellationToken = default)
        => await context.AccountLocks.AddAsync(restriction, cancellationToken);

    public async Task<IReadOnlyList<UserPublishingRestriction>> GetExpiredForUpdateAsync(DateTimeOffset now, string? userId = null,
        CancellationToken cancellationToken = default)
    {
        var query = context.AccountLocks.Where(row => row.LiftedAt == null && row.EndsAt <= now);
        if (context.Database.ProviderName?.Contains("Npgsql", StringComparison.Ordinal) == true)
        {
            if (string.IsNullOrWhiteSpace(userId))
                return await context.AccountLocks.FromSqlInterpolated($"SELECT * FROM \"wesal\".\"UserPublishingRestrictions\" WHERE \"LiftedAt\" IS NULL AND \"EndsAt\" <= {now} ORDER BY \"EndsAt\", \"Id\" FOR UPDATE SKIP LOCKED")
                    .ToListAsync(cancellationToken);
            return await context.AccountLocks.FromSqlInterpolated($"SELECT * FROM \"wesal\".\"UserPublishingRestrictions\" WHERE \"LiftedAt\" IS NULL AND \"EndsAt\" <= {now} AND \"UserId\" = {userId} ORDER BY \"EndsAt\", \"Id\" FOR UPDATE SKIP LOCKED")
                .ToListAsync(cancellationToken);
        }
        if (!string.IsNullOrWhiteSpace(userId)) query = query.Where(row => row.UserId == userId);
        return await query.OrderBy(row => row.EndsAt).ThenBy(row => row.Id).ToListAsync(cancellationToken);
    }

}
