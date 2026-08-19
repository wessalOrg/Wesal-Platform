using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public sealed class ConversationRepository : IConversationRepository
{
    private readonly ApplicationDbContext _context;

    public ConversationRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public Task<Conversation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => _context.Conversations.AsNoTracking().FirstOrDefaultAsync(
            conversation => conversation.Id == id,
            cancellationToken);

    public Task<Conversation?> GetByHallAndInitiatorAsync(
        Guid hallId,
        string initiatorUserId,
        CancellationToken cancellationToken = default)
        => _context.Conversations.AsNoTracking().FirstOrDefaultAsync(
            conversation => conversation.HallId == hallId && conversation.InitiatorUserId == initiatorUserId,
            cancellationToken);

    public async Task AddAsync(Conversation conversation, CancellationToken cancellationToken = default)
    {
        await _context.Conversations.AddAsync(conversation, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
