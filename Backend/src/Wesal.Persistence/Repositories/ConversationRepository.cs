using System.Linq.Expressions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
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
    /// Every user id that currently holds the Admin role (WESAL-TASK-10, Edit 16), ordered by
    /// id purely so the result is stable and reproducible.
    /// <para>
    /// Distinct from <see cref="GetAdminUserIdAsync"/>, which deliberately returns only the
    /// lowest-sorted Admin to fill one thread's counterparty column. That single id is the
    /// root of the shared-inbox gap: a thread created by one Admin was invisible to the rest.
    /// That method is unchanged and still load-bearing for thread RESOLUTION; this one defines
    /// who may SEE and be PUSHED a thread.
    /// </para>
    /// </summary>
    public async Task<IReadOnlyList<string>> GetAdminUserIdsAsync(CancellationToken cancellationToken = default)
    {
        var adminRoleId = await _context.Roles
            .Where(role => role.Name == ApplicationRoles.Admin)
            .Select(role => (string?)role.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (adminRoleId is null)
        {
            return [];
        }

        return await _context.UserRoles
            .Where(userRole => userRole.RoleId == adminRoleId)
            .OrderBy(userRole => userRole.UserId)
            .Select(userRole => userRole.UserId)
            .ToListAsync(cancellationToken);
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
        => await GetParticipantConversationsAsync(userId, isAdmin: false, [], cancellationToken);

    /// <summary>
    /// The caller's inbox. For an Admin this is one shared queue covering every owner/Admin
    /// conversation (WESAL-TASK-10, Edit 16), not just the threads naming that Admin.
    /// </summary>
    public async Task<IReadOnlyList<Conversation>> GetParticipantConversationsAsync(
        string userId,
        bool isAdmin,
        IReadOnlyCollection<string> adminUserIds,
        CancellationToken cancellationToken = default)
    {
        IQueryable<Conversation> query = _context.Conversations
            .AsNoTracking()
            .Include(c => c.Hall);

        // THE shared-inbox rule, as ONE disjunction. This has to be an OR with the two per-user
        // clauses, not a second filter chained onto them: (A OR B) AND (C) would keep only
        // threads where the caller is a party AND the counterparty is Admin-side, which is
        // almost the opposite of a shared inbox — it would drop every thread the caller
        // legitimately already had, and drop shared threads where the caller is also the owner.
        // Written as a single OR it is strictly additive, which is the property that matters:
        // an Admin cannot lose a row they could previously see.
        //
        // The two PlatformSenders comparisons are not redundant with the role lookup: those
        // sentinel values are how an owner-initiated thread and an automated platform notice
        // name the Admin side when no real Admin can be resolved, and they hold no role. See
        // ConversationAccess.IsAdminSide, which is the in-memory twin of this clause.
        //
        // This mirrors the production shape exactly:
        //   WHERE SenderUserId = @me OR HallOwnerId = @me
        //      OR SenderUserId = ANY(@admins) OR SenderUserId IN ('admin','system')
        // which was validated read-only against the live database before being written.
        if (isAdmin)
        {
            var audience = AudienceIncludingCaller(adminUserIds, userId);

            query = query.Where(c => c.SenderUserId == userId
                || c.HallOwnerId == userId
                || audience.Contains(c.SenderUserId)
                || c.SenderUserId == PlatformSenders.AdminFallback
                || c.SenderUserId == PlatformSenders.System);
        }
        else
        {
            // A seeker's or an owner's query is byte-identical to the two-party rule that has
            // always applied to them.
            query = query.Where(c => c.SenderUserId == userId || c.HallOwnerId == userId);
        }

        return await query
            .Where(c => !c.Hall.IsDeleted)
            .Where(VisibleToUser(_context, userId))
            .OrderByDescending(c => c.CreatedAt)
            .ThenByDescending(c => c.Id)
            .ToListAsync(cancellationToken);
    }

    /// <summary>
    /// The caller added to the Admin audience, without re-querying. See
    /// <see cref="ResolveAdminAudienceAsync"/> for why the caller belongs in it; this overload
    /// is for the call sites that were handed the audience by the service already.
    /// </summary>
    private static string[] AudienceIncludingCaller(
        IReadOnlyCollection<string> adminUserIds,
        string userId)
        => adminUserIds.Append(userId).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();

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
        // WESAL-TASK-10, Edit 16: an Admin's inbox is shared, so the count is shared too, and
        // it must select rows by the same disjunction the list uses or the badge would promise
        // threads the list does not show — or, worse, agree numerically while selecting
        // different rows.
        IQueryable<Conversation> query = _context.Conversations
            .AsNoTracking()
            .Where(c => !c.Hall.IsDeleted);

        IReadOnlyList<string> adminIds = [];

        if (isAdmin)
        {
            adminIds = await ResolveAdminAudienceAsync(userId, isAdmin, cancellationToken);

            var audience = adminIds.ToArray();

            // One disjunction, for the same reason as the inbox list.
            query = query.Where(c => c.SenderUserId == userId
                || c.HallOwnerId == userId
                || audience.Contains(c.SenderUserId)
                || c.SenderUserId == PlatformSenders.AdminFallback
                || c.SenderUserId == PlatformSenders.System);
        }
        else
        {
            query = query.Where(c => c.SenderUserId == userId || c.HallOwnerId == userId);
        }

        query = query.Where(VisibleToUser(_context, userId));

        // THE unread rule, half one: a conversation is unread when it holds at least one
        // message from the OTHER PARTY that the caller's read watermark does not cover.
        // GetUnreadStatusAsync below states the same rule per message. WESAL-TASK-10: these
        // two used to disagree — this one counted only the other party's messages while the
        // flag compared the watermark against the newest message WHOSEVER sent it, so a
        // thread the user had just replied in showed a stale unread badge while the count
        // said zero. The tests pin them together.
        var incoming = IncomingMessageFilter(userId, isAdmin, adminIds);

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
                .Where(m => m.ConversationId == c.Id)
                .Where(incoming)
                .Any(m => !_context.ConversationReadStates
                    .Any(s => s.ConversationId == c.Id && s.UserId == userId && s.LastReadAt >= m.CreatedAt)))
            .CountAsync(cancellationToken);
    }

    /// <summary>
    /// The Admin audience for one caller: everyone the role table says is an Admin, plus the
    /// caller themselves (WESAL-TASK-10, Edit 16).
    /// <para>
    /// The union is what makes this change strictly additive rather than a trade. Every
    /// decision below is "is this sender on the Admin side", and the caller has already been
    /// established as an Admin by the time <c>isAdmin</c> is true — so treating them as
    /// Admin-side is always correct, and it removes the one way this could have made an Admin's
    /// inbox SMALLER than it already was.
    /// </para>
    /// <para>
    /// That failure mode was real, not theoretical: <c>isAdmin</c> comes from the caller's
    /// claims while the role list comes from the database, and any disagreement between them
    /// (a role lookup that returns nothing, a test double, an account whose role row is
    /// missing) would otherwise have dropped rows the caller could previously see. The
    /// caller's own threads still match the per-user clause regardless, but their own messages
    /// also have to stop counting as incoming, which is the same union seen from the other
    /// side.
    /// </para>
    /// </summary>
    private async Task<string[]> ResolveAdminAudienceAsync(
        string userId,
        bool isAdmin,
        CancellationToken cancellationToken)
    {
        if (!isAdmin)
        {
            return [];
        }

        var adminUserIds = await GetAdminUserIdsAsync(cancellationToken);

        return adminUserIds
            .Append(userId)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    /// <summary>
    /// "A message from the other party", as an expression the provider can translate
    /// (WESAL-TASK-10, Edit 16).
    /// <para>
    /// For a seeker or an owner this stays exactly what it has always been: any message not
    /// sent by the caller. Those threads are genuinely two-party, so the identity test is the
    /// whole rule.
    /// </para>
    /// <para>
    /// For an Admin the other party is any non-Admin sender — in practice the owner — and a
    /// colleague's reply must not count, because nearly all traffic in these threads is
    /// Admin-to-Admin and counting it as incoming would leave every Admin's badge permanently
    /// lit with no information in it. The caller's own messages are excluded explicitly as well
    /// as via the audience, which is what keeps an Admin who is also a thread owner from
    /// marking their own words unread.
    /// </para>
    /// <para>
    /// Built inline rather than through ConversationAccess.IsAdminSide because EF will not
    /// translate a method call on a captured collection inside a Where; the two are pinned to
    /// each other by the shared-inbox tests.
    /// </para>
    /// </summary>
    private static Expression<Func<Message, bool>> IncomingMessageFilter(
        string userId,
        bool isAdmin,
        IReadOnlyCollection<string> adminUserIds)
    {
        if (!isAdmin)
        {
            return m => m.SenderUserId != userId;
        }

        var adminIds = adminUserIds.ToArray();

        return m => m.SenderUserId != userId
            && !adminIds.Contains(m.SenderUserId)
            && m.SenderUserId != PlatformSenders.AdminFallback
            && m.SenderUserId != PlatformSenders.System;
    }

    public async Task<Dictionary<Guid, bool>> GetUnreadStatusAsync(string userId, IReadOnlyCollection<Guid> conversationIds, CancellationToken cancellationToken = default)
        => await GetUnreadStatusAsync(userId, isAdmin: false, [], conversationIds, cancellationToken);

    /// <summary>
    /// Per-row unread flags, sharing half one of the rule with
    /// <see cref="GetUnreadConversationCountAsync"/> so a row's flag and the badge can never
    /// disagree (WESAL-TASK-10, Edit 16).
    /// </summary>
    public async Task<Dictionary<Guid, bool>> GetUnreadStatusAsync(
        string userId,
        bool isAdmin,
        IReadOnlyCollection<string> adminUserIds,
        IReadOnlyCollection<Guid> conversationIds,
        CancellationToken cancellationToken = default)
    {
        if (conversationIds.Count == 0)
        {
            return [];
        }

        // Same watermark rule as the inbox and the badge: a conversation this participant
        // has hidden reports not-unread, so the flag can never advertise a thread that the
        // list is deliberately not showing them. Hiding stays per-user even in the shared
        // Admin inbox, so this remains a statement about the caller alone.
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
        // thread can never be counted in one query and not the other. For an Admin, "the other
        // party" is the owner rather than "anybody who is not me", so a colleague's reply does
        // not light this Admin's badge. The watermark compared against is still this Admin's
        // OWN row: the inbox is shared but read state is personal, so the same thread can be
        // read for one Admin and unread for another.
        var incoming = IncomingMessageFilter(userId, isAdmin, adminUserIds);

        var unreadIds = await _context.Messages
            .AsNoTracking()
            .Where(m => conversationIds.Contains(m.ConversationId))
            .Where(incoming)
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

    public async Task<Dictionary<Guid, int>> GetUnreadMessageCountsAsync(
        string userId,
        IReadOnlyCollection<Guid> conversationIds,
        CancellationToken cancellationToken = default)
        => await GetUnreadMessageCountsAsync(userId, isAdmin: false, [], conversationIds, cancellationToken);

    /// <summary>
    /// The numeric counterpart to <see cref="GetUnreadStatusAsync(string, bool,
    /// IReadOnlyCollection{string}, IReadOnlyCollection{Guid}, CancellationToken)"/>, built
    /// from the identical rule (WESAL-TASK-10, Edit 14).
    /// <para>
    /// The only difference is the terminal operator: where the flag asks <c>Any</c> whether
    /// one qualifying message exists, this asks how many qualify. Everything upstream of that
    /// — the hidden-thread exclusion, the incoming-message filter, and the caller's own
    /// per-user watermark — is the same expression, so a row is unread exactly when this
    /// count is greater than zero.
    /// </para>
    /// </summary>
    public async Task<Dictionary<Guid, int>> GetUnreadMessageCountsAsync(
        string userId,
        bool isAdmin,
        IReadOnlyCollection<string> adminUserIds,
        IReadOnlyCollection<Guid> conversationIds,
        CancellationToken cancellationToken = default)
    {
        if (conversationIds.Count == 0)
        {
            return [];
        }

        var hiddenIds = await _context.ConversationReadStates
            .AsNoTracking()
            .Where(s => conversationIds.Contains(s.ConversationId)
                && s.UserId == userId
                && s.HiddenAt != null
                && !_context.Messages.Any(m => m.ConversationId == s.ConversationId && m.CreatedAt > s.HiddenAt.Value))
            .Select(s => s.ConversationId)
            .ToListAsync(cancellationToken);

        var hiddenSet = hiddenIds.ToHashSet();

        var incoming = IncomingMessageFilter(userId, isAdmin, adminUserIds);

        var counts = await _context.Messages
            .AsNoTracking()
            .Where(m => conversationIds.Contains(m.ConversationId))
            .Where(incoming)
            .Where(m => !_context.ConversationReadStates
                .Any(s => s.ConversationId == m.ConversationId && s.UserId == userId && s.LastReadAt >= m.CreatedAt))
            .GroupBy(m => m.ConversationId)
            .Select(group => new { ConversationId = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken);

        var countLookup = counts.ToDictionary(entry => entry.ConversationId, entry => entry.Count);

        return conversationIds.ToDictionary(
            conversationId => conversationId,
            // A hidden thread reports zero rather than disappearing, so the number a client
            // renders can never contradict the boolean it renders beside it.
            conversationId => hiddenSet.Contains(conversationId)
                ? 0
                : countLookup.GetValueOrDefault(conversationId));
    }
}
