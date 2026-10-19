using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public sealed class HelpTicketRepository(ApplicationDbContext db) : IHelpTicketRepository
{
    public async Task AddAsync(HelpTicket ticket, CancellationToken cancellationToken = default)
    {
        db.HelpTickets.Add(ticket);
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task<HelpTicket?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => db.HelpTickets.FirstOrDefaultAsync(ticket => ticket.Id == id, cancellationToken);

    public async Task<IReadOnlyList<HelpTicket>> ListForUserAsync(
        string userId,
        CancellationToken cancellationToken = default)
        => await db.HelpTickets
            .AsNoTracking()
            .Where(ticket => ticket.UserId == userId)
            .OrderByDescending(ticket => ticket.CreatedAt)
            .ThenByDescending(ticket => ticket.Id)
            .ToListAsync(cancellationToken);

    public async Task<PagedResult<HelpTicket>> ListAllAsync(
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.HelpTickets.AsNoTracking();
        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(ticket => ticket.CreatedAt)
            .ThenByDescending(ticket => ticket.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return PagedResult<HelpTicket>.Create(items, page, pageSize, totalCount);
    }

    public async Task MarkConversationReadAsync(
        string userId,
        DateTimeOffset readAt,
        CancellationToken cancellationToken = default)
    {
        var unread = await db.HelpTickets
            .Where(ticket => ticket.UserId == userId && ticket.ReadByAdminAt == null)
            .ToListAsync(cancellationToken);

        if (unread.Count == 0) return;

        foreach (var ticket in unread)
        {
            ticket.ReadByAdminAt = readAt;
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken = default)
        => db.SaveChangesAsync(cancellationToken);
}
