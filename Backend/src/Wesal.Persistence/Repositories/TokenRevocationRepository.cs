using Microsoft.Extensions.Caching.Memory;
using Npgsql;
using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public sealed class TokenRevocationRepository : ITokenRevocationRepository
{
    private const string CacheKeyPrefix = "revoked-token:";
    private static readonly TimeSpan RevocationCacheLifetime = TimeSpan.FromHours(24);
    private static readonly TimeSpan RetentionWindow = TimeSpan.FromHours(24);

    private readonly ApplicationDbContext _context;
    private readonly IMemoryCache _cache;

    public TokenRevocationRepository(ApplicationDbContext context)
        : this(context, new MemoryCache(new MemoryCacheOptions()))
    {
    }

    public TokenRevocationRepository(ApplicationDbContext context, IMemoryCache cache)
    {
        _context = context;
        _cache = cache;
    }

    public async Task<bool> IsRevokedAsync(string jti, CancellationToken cancellationToken = default)
    {
        var key = CacheKeyPrefix + jti;
        if (_cache.TryGetValue(key, out bool revoked) && revoked)
        {
            return true;
        }

        var isRevoked = await _context.RevokedTokens
            .AsNoTracking()
            .AnyAsync(token => token.Jti == jti, cancellationToken);

        if (isRevoked)
        {
            _cache.Set(key, true, RevocationCacheLifetime);
        }

        return isRevoked;
    }

    public async Task<bool> RevokeAsync(string jti, string userId, CancellationToken cancellationToken = default)
    {
        if (await IsRevokedAsync(jti, cancellationToken))
        {
            return false;
        }

        try
        {
            await _context.RevokedTokens.AddAsync(
                new RevokedToken { Jti = jti, UserId = userId },
                cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);

            _cache.Set(CacheKeyPrefix + jti, true, RevocationCacheLifetime);

            await PurgeExpiredAsync(cancellationToken);

            return true;
        }
        catch (DbUpdateException exception) when (IsUniqueViolation(exception))
        {
            return false;
        }
    }

    private async Task PurgeExpiredAsync(CancellationToken cancellationToken)
    {
        var cutoff = DateTimeOffset.UtcNow - RetentionWindow;

        if (_context.Database.IsRelational())
        {
            await _context.RevokedTokens
                .Where(token => token.RevokedAt < cutoff)
                .ExecuteDeleteAsync(cancellationToken);
        }
        else
        {
            var expired = await _context.RevokedTokens
                .Where(token => token.RevokedAt < cutoff)
                .ToListAsync(cancellationToken);

            if (expired.Count > 0)
            {
                _context.RevokedTokens.RemoveRange(expired);
                await _context.SaveChangesAsync(cancellationToken);
            }
        }
    }

    private static bool IsUniqueViolation(DbUpdateException exception)
        => exception.InnerException is NpgsqlException { SqlState: PostgresErrorCodes.UniqueViolation };
}