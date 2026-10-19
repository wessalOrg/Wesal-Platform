using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

/// <summary>Durable Help Center tickets ("مركز المساعدة").</summary>
public interface IHelpTicketRepository
{
    Task AddAsync(HelpTicket ticket, CancellationToken cancellationToken = default);

    /// <summary>Tracked lookup, so the service can mutate and save a reply.</summary>
    Task<HelpTicket?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>The caller's own tickets, newest first.</summary>
    Task<IReadOnlyList<HelpTicket>> ListForUserAsync(string userId, CancellationToken cancellationToken = default);

    /// <summary>Every ticket for the Admin queue, newest first.</summary>
    Task<PagedResult<HelpTicket>> ListAllAsync(int page, int pageSize, CancellationToken cancellationToken = default);

    /// <summary>
    /// Clears the Admin "unread" marker for every ticket the given owner has filed. Used when an
    /// Admin opens a conversation so the shared badge drops the moment it is looked at.
    /// </summary>
    Task MarkConversationReadAsync(string userId, DateTimeOffset readAt, CancellationToken cancellationToken = default);

    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
