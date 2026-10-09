using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public sealed class AiConversationSessionStore : IAiConversationSessionStore
{
    private readonly ApplicationDbContext _context;

    public AiConversationSessionStore(ApplicationDbContext context) => _context = context;

    public Task<AiConversationSession?> GetAsync(Guid sessionId, CancellationToken cancellationToken = default)
        => _context.AiConversationSessions.AsNoTracking()
            .FirstOrDefaultAsync(session => session.SessionId == sessionId, cancellationToken);

    public async Task AddAsync(AiConversationSession session, CancellationToken cancellationToken = default)
    {
        _context.AiConversationSessions.Add(session);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<bool> TryUpdateAsync(
        AiConversationSession session,
        int expectedRevision,
        CancellationToken cancellationToken = default)
    {
        _context.Attach(session);
        _context.Entry(session).State = EntityState.Modified;
        var revision = _context.Entry(session).Property(value => value.Revision);
        revision.OriginalValue = expectedRevision;
        revision.CurrentValue = expectedRevision + 1;

        try
        {
            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            _context.Entry(session).State = EntityState.Detached;
            return false;
        }
    }

    public async Task DeleteForUserAsync(string userId, CancellationToken cancellationToken = default)
    {
        await _context.AiConversationSessions
            .Where(session => session.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
    }

    public async Task DeleteExpiredAsync(DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        await _context.AiConversationSessions
            .Where(session => session.ExpiresAt <= now)
            .ExecuteDeleteAsync(cancellationToken);
    }
}
