using System.Linq.Expressions;
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

    /// <summary>
    /// Resolves the single seeker-to-owner thread for (hall, seeker) — the "Contact this
    /// hall's owner" path (WESAL-TASK-6, Edit 6).
    ///
    /// The seeker/owner/hall relationship is the thread's real identity, so lookup keys on
    /// (HallId, SenderUserId): the same seeker asking about the same hall always resolves to
    /// the same thread, while asking about a different hall (or about a different owner's
    /// hall) correctly gets its own thread.
    ///
    /// Ordering matters and is the same discipline already applied to
    /// <see cref="GetByHallForOwnerAsync"/>. There is no unique constraint on
    /// (HallId, SenderUserId) — the database cannot prevent two concurrent contact requests
    /// from inserting — so an unordered FirstOrDefaultAsync would silently resolve to a
    /// different thread on each call for a (hall, seeker) pair that somehow holds more than
    /// one row. Ordering by CreatedAt then Id makes the oldest thread win deterministically,
    /// so the resolved thread is stable across calls. Pre-existing duplicate rows are left
    /// in place; nothing merges or deletes conversation history.
    /// </summary>
    public async Task<Conversation?> GetByHallAndUserAsync(Guid hallId, string userId, CancellationToken cancellationToken = default)
    {
        return await _context.Conversations
            .Where(c => c.HallId == hallId && c.SenderUserId == userId)
            .OrderBy(c => c.CreatedAt)
            .ThenBy(c => c.Id)
            .FirstOrDefaultAsync(cancellationToken);
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

    public async Task HideConversationAsync(Guid conversationId, string userId, DateTimeOffset hiddenAt, CancellationToken cancellationToken = default)
    {
        var existing = await _context.ConversationReadStates
            .FirstOrDefaultAsync(s => s.ConversationId == conversationId && s.UserId == userId, cancellationToken);

        if (existing is null)
        {
            // Deliberately leaves LastReadAt at its default: hiding a thread is not reading
            // it, so a conversation hidden before it was ever opened still counts as unread
            // if it later re-appears through new activity.
            _context.ConversationReadStates.Add(new ConversationReadState
            {
                ConversationId = conversationId,
                UserId = userId,
                HiddenAt = hiddenAt
            });
        }
        else
        {
            // Re-hiding refreshes the watermark, so a thread that had un-hidden itself
            // through new messages goes back out of this participant's inbox.
            existing.HiddenAt = hiddenAt;
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// The per-user visibility rule (WESAL-TASK-6, Edit 6), shared by the inbox list, the
    /// unread badge and the per-conversation unread flags so all three can never disagree.
    ///
    /// A conversation is hidden for <paramref name="userId"/> only while that participant has
    /// a hide watermark AND no message has arrived since it. Because the watermark is a
    /// timestamp rather than a flag, a new message un-hides the thread on its own: this is
    /// the whole re-appear mechanism, with no extra state and nothing to reconcile.
    /// </summary>
    internal static Expression<Func<Conversation, bool>> VisibleToUser(
        ApplicationDbContext context,
        string userId)
    {
        return conversation => !context.ConversationReadStates.Any(state =>
            state.ConversationId == conversation.Id
            && state.UserId == userId
            && state.HiddenAt != null
            && !context.Messages.Any(message =>
                message.ConversationId == conversation.Id
                && message.CreatedAt > state.HiddenAt.Value));
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
            .Where(VisibleToUser(_context, userId))
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
            .Where(VisibleToUser(_context, userId))
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

        // Same watermark rule as the inbox and the badge: a conversation this participant
        // has hidden reports not-unread, so the flag can never advertise a thread that the
        // list is deliberately not showing them.
        var hiddenIds = await _context.ConversationReadStates
            .AsNoTracking()
            .Where(s => conversationIds.Contains(s.ConversationId)
                && s.UserId == userId
                && s.HiddenAt != null
                && !_context.Messages.Any(m => m.ConversationId == s.ConversationId && m.CreatedAt > s.HiddenAt.Value))
            .Select(s => s.ConversationId)
            .ToListAsync(cancellationToken);

        var hiddenSet = hiddenIds.ToHashSet();

        var latestMessages = await _context.Messages
            .AsNoTracking()
            .Where(m => conversationIds.Contains(m.ConversationId))
            .GroupBy(m => m.ConversationId)
            .Select(g => new { ConversationId = g.Key, LatestAt = g.Max(m => m.CreatedAt) })
            .ToListAsync(cancellationToken);

        var result = new Dictionary<Guid, bool>();
        foreach (var convId in conversationIds)
        {
            if (hiddenSet.Contains(convId))
            {
                result[convId] = false;
                continue;
            }

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
