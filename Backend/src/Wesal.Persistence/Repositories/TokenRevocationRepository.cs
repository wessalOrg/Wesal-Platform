using Npgsql;
using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public sealed class TokenRevocationRepository : ITokenRevocationRepository
{
    private readonly ApplicationDbContext _context;

    public TokenRevocationRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<bool> IsRevokedAsync(string jti, CancellationToken cancellationToken = default)
        => await _context.RevokedTokens
            .AsNoTracking()
            .AnyAsync(token => token.Jti == jti, cancellationToken);

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

            return true;
        }
        catch (DbUpdateException exception) when (IsUniqueViolation(exception))
        {
            return false;
        }
    }

    private static bool IsUniqueViolation(DbUpdateException exception)
        => exception.InnerException is NpgsqlException { SqlState: PostgresErrorCodes.UniqueViolation };
}