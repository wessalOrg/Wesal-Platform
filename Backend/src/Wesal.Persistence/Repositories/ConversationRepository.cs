using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
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

    public async Task AddAsync(Conversation conversation, CancellationToken cancellationToken = default)
    {
        await _context.Conversations.AddAsync(conversation, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<Conversation?> GetByHallAndUserAsync(Guid hallId, string userId, CancellationToken cancellationToken = default)
    {
        return await _context.Conversations
            .FirstOrDefaultAsync(c => c.HallId == hallId && c.SenderUserId == userId, cancellationToken);
    }

    /// <summary>
    /// Resolves the single owner-to-Admin thread for a hall (WESAL-TASK-4, Edit 4).
    ///
    /// The owner/Admin relationship is the thread's real identity, so lookup keys on
    /// (HallId, HallOwnerId) and NOT on the Admin who happens to act. This makes every
    /// Admin message for a hall land in the same thread regardless of which Admin sent
    /// it. Historical rows created before this rule (one per Admin) are left untouched; the
    /// oldest thread wins deterministically so the resolution is stable across calls and
    /// the returned thread never changes for a given hall/owner.
    /// </summary>
    public async Task<Conversation?> GetByHallForOwnerAsync(Guid hallId, string ownerId, CancellationToken cancellationToken = default)
    {
        return await _context.Conversations
            .Where(c => c.HallId == hallId && c.HallOwnerId == ownerId)
            .OrderBy(c => c.CreatedAt)
            .ThenBy(c => c.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<Conversation?> GetByIdWithHallAsync(Guid conversationId, CancellationToken cancellationToken = default)
    {
        return await _context.Conversations
            .Include(c => c.Hall)
            .FirstOrDefaultAsync(c => c.Id == conversationId, cancellationToken);
    }

    public async Task<IReadOnlyList<Conversation>> GetParticipantConversationsAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        return await _context.Conversations
            .AsNoTracking()
            .Include(c => c.Hall)
            .Where(c => c.SenderUserId == userId || c.HallOwnerId == userId)
            .Where(c => !c.Hall.IsDeleted)
            .OrderByDescending(c => c.CreatedAt)
            .ThenByDescending(c => c.Id)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<UserDisplayInfo>> GetUserDisplayNamesAsync(
        IReadOnlyCollection<string> userIds,
        CancellationToken cancellationToken = default)
    {
        if (userIds.Count == 0)
        {
            return [];
        }

        return await _context.Users
            .AsNoTracking()
            .Where(user => userIds.Contains(user.Id))
            .Select(user => new UserDisplayInfo { UserId = user.Id, FullName = user.FullName })
            .ToListAsync(cancellationToken);
    }

    public async Task UpsertReadStateAsync(Guid conversationId, string userId, DateTimeOffset lastReadAt, CancellationToken cancellationToken = default)
    {
        var existing = await _context.ConversationReadStates
            .FirstOrDefaultAsync(s => s.ConversationId == conversationId && s.UserId == userId, cancellationToken);

        if (existing is null)
        {
            _context.ConversationReadStates.Add(new ConversationReadState
            {
                ConversationId = conversationId,
                UserId = userId,
                LastReadAt = lastReadAt
            });
        }
        else if (lastReadAt > existing.LastReadAt)
        {
            existing.LastReadAt = lastReadAt;
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<int> GetUnreadConversationCountAsync(string userId, CancellationToken cancellationToken = default)
    {
        return await _context.Conversations
            .AsNoTracking()
            .Where(c => (c.SenderUserId == userId || c.HallOwnerId == userId) && !c.Hall.IsDeleted)
            .Where(c => _context.Messages
                .Where(m => m.ConversationId == c.Id && m.SenderUserId != userId)
                .Any(m => !_context.ConversationReadStates
                    .Any(s => s.ConversationId == c.Id && s.UserId == userId && s.LastReadAt >= m.CreatedAt)))
            .CountAsync(cancellationToken);
    }

    public async Task<Dictionary<Guid, bool>> GetUnreadStatusAsync(string userId, IReadOnlyCollection<Guid> conversationIds, CancellationToken cancellationToken = default)
    {
        if (conversationIds.Count == 0)
        {
            return [];
        }

        var readStates = await _context.ConversationReadStates
            .AsNoTracking()
            .Where(s => conversationIds.Contains(s.ConversationId) && s.UserId == userId)
            .ToListAsync(cancellationToken);

        var readStateMap = readStates.ToDictionary(s => s.ConversationId, s => s.LastReadAt);

        var latestMessages = await _context.Messages
            .AsNoTracking()
            .Where(m => conversationIds.Contains(m.ConversationId))
            .GroupBy(m => m.ConversationId)
            .Select(g => new { ConversationId = g.Key, LatestAt = g.Max(m => m.CreatedAt) })
            .ToListAsync(cancellationToken);

        var result = new Dictionary<Guid, bool>();
        foreach (var convId in conversationIds)
        {
            var latest = latestMessages.FirstOrDefault(m => m.ConversationId == convId);
            if (latest is null)
            {
                result[convId] = false;
                continue;
            }

            if (!readStateMap.TryGetValue(convId, out var lastRead))
            {
                result[convId] = true;
                continue;
            }

            result[convId] = latest.LatestAt > lastRead;
        }

        return result;
    }
}
