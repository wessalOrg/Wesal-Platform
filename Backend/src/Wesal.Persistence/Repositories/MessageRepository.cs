using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public sealed class MessageRepository : IMessageRepository
{
    private readonly ApplicationDbContext _context;

    public MessageRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(Message message, CancellationToken cancellationToken = default)
    {
        await _context.Messages.AddAsync(message, cancellationToken);
    }

    public async Task<IReadOnlyList<Message>> GetByConversationAsync(
        Guid conversationId,
        CancellationToken cancellationToken = default)
    {
        return await _context.Messages
            .AsNoTracking()
            .Where(message => message.ConversationId == conversationId)
            .OrderBy(message => message.CreatedAt)
            .ThenBy(message => message.Id)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Message>> GetByConversationIdsAsync(
        IReadOnlyCollection<Guid> conversationIds,
        CancellationToken cancellationToken = default)
    {
        if (conversationIds.Count == 0)
        {
            return [];
        }

        return await _context.Messages
            .AsNoTracking()
            .Where(message => conversationIds.Contains(message.ConversationId))
            .OrderBy(message => message.ConversationId)
            .ThenBy(message => message.CreatedAt)
            .ThenBy(message => message.Id)
            .ToListAsync(cancellationToken);
    }
}