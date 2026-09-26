using System.Linq.Expressions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
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
    /// Picks a stable Admin id for the counterparty slot of an owner/Admin thread
    /// (WESAL-TASK-11, Edit 11). Ordered by id so repeated calls always agree on the same
    /// Admin rather than racing between several, mirroring the deterministic tie-break
    /// already used by <see cref="GetByHallForOwnerAsync"/>.
    /// </summary>
    public async Task<string?> GetAdminUserIdAsync(CancellationToken cancellationToken = default)
    {
        var adminRoleId = await _context.Roles
            .Where(role => role.Name == ApplicationRoles.Admin)
            .Select(role => (string?)role.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (adminRoleId is null)
        {
            return null;
        }

        return await _context.UserRoles
            .Where(userRole => userRole.RoleId == adminRoleId)
            .OrderBy(userRole => userRole.UserId)
            .Select(userRole => (string?)userRole.UserId)
            .FirstOrDefaultAsync(cancellationToken);
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
        await SaveReadStateAsync(
            conversationId,
            userId,
            state =>
            {
                // Re-hiding refreshes the watermark, so a thread that had un-hidden itself
                // through new messages goes back out of this participant's inbox.
                state.HiddenAt = hiddenAt;
            },
            cancellationToken);
    }

    /// <summary>
    /// WESAL-TASK-10 (Edit 10): applies a change to this participant's read-state row, creating
    /// it when it does not exist yet.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <c>ConversationReadState</c> has a composite primary key of (ConversationId, UserId).
    /// Reading the row and then inserting it is therefore a race: two requests that both observe
    /// "no row" — a double-tapped "mark as read", or a read racing a hide — both insert, and the
    /// second <c>SaveChangesAsync</c> fails on the key. That exception was not handled anywhere,
    /// so an ordinary client gesture surfaced as an unhandled 500.
    /// </para>
    /// <para>
    /// On losing that race the losing insert is detached and the same change is applied to the
    /// row that won, which is exactly the state the caller asked for. The message-send path
    /// already recovers from the same race on its own unique index, so this keeps the two
    /// consistent.
    /// </para>
    /// </remarks>
    private async Task SaveReadStateAsync(
        Guid conversationId,
        string userId,
        Action<ConversationReadState> applyChange,
        CancellationToken cancellationToken)
    {
        var existing = await FindReadStateAsync(conversationId, userId, cancellationToken);

        if (existing is not null)
        {
            applyChange(existing);
            await _context.SaveChangesAsync(cancellationToken);
            return;
        }

        var candidate = new ConversationReadState
        {
            ConversationId = conversationId,
            UserId = userId
        };

        // A brand-new row deliberately leaves LastReadAt at its default: hiding a thread is not
        // reading it, so a conversation hidden before it was ever opened still counts as unread
        // if it later re-appears through new activity.
        applyChange(candidate);
        _context.ConversationReadStates.Add(candidate);

        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            _context.Entry(candidate).State = EntityState.Detached;

            var winner = await FindReadStateAsync(conversationId, userId, cancellationToken);

            if (winner is null)
            {
                throw;
            }

            applyChange(winner);
            await _context.SaveChangesAsync(cancellationToken);
        }
    }

    private Task<ConversationReadState?> FindReadStateAsync(
        Guid conversationId,
        string userId,
        CancellationToken cancellationToken)
        => _context.ConversationReadStates
            .FirstOrDefaultAsync(s => s.ConversationId == conversationId && s.UserId == userId, cancellationToken);

    /// <summary>
    /// WESAL-TASK-10 (Edit 10): recognises a Postgres unique-constraint violation (SQLSTATE
    /// 23505) on the exception or its inner exception, matching how the message-send path
    /// detects the same condition.
    /// </summary>
    private static bool IsUniqueViolation(Exception exception)
    {
        const string uniqueViolation = "23505";

        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current.Message.Contains(uniqueViolation, StringComparison.Ordinal))
            {
                return true;
            }
        }

        return false;
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
        await SaveReadStateAsync(
            conversationId,
            userId,
            state =>
            {
                // Last read only ever moves forward, so a delayed request cannot un-read a
                // thread that a later one already read.
                if (lastReadAt > state.LastReadAt)
                {
                    state.LastReadAt = lastReadAt;
                }
            },
            cancellationToken);
    }

    public async Task<int> GetUnreadConversationCountAsync(string userId, bool isAdmin, CancellationToken cancellationToken = default)
    {
        // THE unread rule, half one: a conversation is unread when it holds at least one
        // message from the OTHER PARTY that the caller's read watermark does not cover.
        // GetUnreadStatusAsync below states the same rule per message. WESAL-TASK-10: these
        // two used to disagree — this one counted only the other party's messages while the
        // flag compared the watermark against the newest message WHOSEVER sent it, so a
        // thread the user had just replied in showed a stale unread badge while the count
        // said zero. The tests pin them together.
        var query = _context.Conversations
            .AsNoTracking()
            .Where(c => (c.SenderUserId == userId || c.HallOwnerId == userId) && !c.Hall.IsDeleted)
            .Where(VisibleToUser(_context, userId));

        // WESAL-TASK-10, Edit 14: the count must not advertise a thread the caller cannot
        // open, or the badge counts something the inbox refuses to show.
        //
        // This is the owner half of ConversationAccess.CanAccess, written inline because EF
        // will not translate a call to a private helper inside Where. Note that the payment
        // requirement cannot appear here: the full gate admits a thread owner unless the hall
        // is Admin-locked or system-locked, because Edit 4 waives payment for a hall owner
        // entirely (an unpaid owner is not locked out of their own payment thread). Reducing
        // the gate to those two flags is what keeps this filter and the inbox list's
        // ConversationAccess.CanAccess call in agreement; adding the payment check back
        // would make the badge disagree with the list again.
        //
        // A non-Approved hall is not locked out of (its owner must keep reading review and
        // rejection messages, US-ADMIN-03), and a deleted hall never reaches here.
        if (!isAdmin)
        {
            query = query.Where(c => !(c.HallOwnerId == userId
                && c.Hall.Status == HallStatus.Approved
                && (c.Hall.IsAdminLocked || c.Hall.SystemLocked)));
        }

        return await query
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

        // THE unread rule, half two: the same per-message test as the count above, so a
        // thread can never be counted in one query and not the other. Only the other
        // party's messages can make a thread unread, so a conversation containing nothing
        // but the caller's own messages reports not-unread.
        var unreadIds = await _context.Messages
            .AsNoTracking()
            .Where(m => conversationIds.Contains(m.ConversationId) && m.SenderUserId != userId)
            .Where(m => !_context.ConversationReadStates
                .Any(s => s.ConversationId == m.ConversationId && s.UserId == userId && s.LastReadAt >= m.CreatedAt))
            .Select(m => m.ConversationId)
            .Distinct()
            .ToListAsync(cancellationToken);

        var unreadSet = unreadIds.ToHashSet();

        return conversationIds.ToDictionary(
            conversationId => conversationId,
            conversationId => !hiddenSet.Contains(conversationId) && unreadSet.Contains(conversationId));
    }
}
