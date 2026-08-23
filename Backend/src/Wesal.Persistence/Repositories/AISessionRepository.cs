using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public class AISessionRepository : GenericRepository<AISession>, IAISessionRepository
{
    private readonly ApplicationDbContext _context;

    public AISessionRepository(ApplicationDbContext context) : base(context)
    {
        _context = context;
    }

    public async Task<AISession?> GetBySessionIdAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        return await _context.AISessions.FirstOrDefaultAsync(s => s.SessionId == sessionId, cancellationToken);
    }

    public async Task<AISession?> GetActiveSessionByUserIdAsync(string userId, CancellationToken cancellationToken = default)
    {
        return await _context.AISessions
            .FirstOrDefaultAsync(s => s.UserId == userId && !s.IsGuestSession, cancellationToken);
    }

    public async Task<AISession?> GetActiveGuestSessionAsync(string guestIdentifier, CancellationToken cancellationToken = default)
    {
        return await _context.AISessions
            .FirstOrDefaultAsync(s => s.GuestIdentifier == guestIdentifier && s.IsGuestSession, cancellationToken);
    }

    public async Task<IReadOnlyList<AISession>> GetExpiredSessionsAsync(CancellationToken cancellationToken = default)
    {
        var cutoff = DateTime.UtcNow.AddHours(-24);
        // Use client evaluation for IsExpired to ensure consistent handling of nullable LastAccessedAt
        // and avoid EF translation issues. Efficient enough for AI session dataset.
        var all = await _context.AISessions.AsNoTracking().ToListAsync(cancellationToken);
        return all.Where(s => s.IsExpired).ToList();
    }
}