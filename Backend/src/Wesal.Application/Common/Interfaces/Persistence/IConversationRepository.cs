using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IConversationRepository
{
    Task AddAsync(Conversation conversation, CancellationToken cancellationToken = default);

    Task<Conversation?> GetByHallAndUserAsync(Guid hallId, string userId, CancellationToken cancellationToken = default);

    Task<Conversation?> GetByHallForOwnerAsync(Guid hallId, string ownerId, CancellationToken cancellationToken = default)
    {
        return Task.FromResult<Conversation?>(null);
    }

    /// <summary>
    /// Resolves the id of a user holding the Admin role, used to fill the Admin
    /// counterparty slot of an owner/Admin thread (WESAL-TASK-11, Edit 11).
    ///
    /// Admin-side services never need this: the acting Admin supplies their own id. It is
    /// only needed when the OWNER opens the thread from their side, where no Admin is
    /// logged in, yet the thread still has to land in a real Admin's conversation list.
    /// Returns null when no Admin account exists.
    /// </summary>
    Task<string?> GetAdminUserIdAsync(CancellationToken cancellationToken = default)
    {
        return Task.FromResult<string?>(null);
    }

    /// <summary>
    /// Every user id that currently holds the Admin role (WESAL-TASK-10, Edit 16).
    /// <para>
    /// The shared-admin inbox needs the whole set, not the single deterministic id that
    /// <see cref="GetAdminUserIdAsync"/> returns: that one is deliberately the LOWEST-sorted
    /// Admin, used only to fill a thread's counterparty column, and it says nothing about who
    /// else is an Admin. It is left exactly as it is.
    /// </para>
    /// <para>
    /// Resolving the set once and passing it down (rather than letting each query run its own
    /// role join) is what lets the inbox list, the unread rule, the row's displayed
    /// counterparty and live delivery all agree on one audience. Empty means "no Admin
    /// accounts exist", which is why the platform-sender values are also needed to recognise
    /// an Admin-side thread.
    /// </para>
    /// </summary>
    Task<IReadOnlyList<string>> GetAdminUserIdsAsync(CancellationToken cancellationToken = default)
    {
        return Task.FromResult<IReadOnlyList<string>>([]);
    }

    Task<Conversation?> GetByIdWithHallAsync(Guid conversationId, CancellationToken cancellationToken = default);

    /// <summary>
    /// The caller's inbox, and for an Admin EVERY owner/Admin conversation (Edit 16).
    /// <para>
    /// An Admin's list is a single shared queue: an owner/Admin thread belongs to the Admin
    /// ROLE, not to whichever Admin created it, so it is returned for every Admin. The two
    /// per-user clauses are kept as well, so an Admin still sees threads they created
    /// themselves and any conversation about a hall they own.
    /// </para>
    /// <para>
    /// <paramref name="adminUserIds"/> comes from <see cref="GetAdminUserIdsAsync"/> and is
    /// ignored when <paramref name="isAdmin"/> is false, so a seeker's or an owner's query is
    /// byte-identical to the two-party rule that has always applied to them. Seeker/owner
    /// threads are never shared: the extra clause only ever matches a counterparty that is
    /// itself on the Admin side.
    /// </para>
    /// <para>
    /// The default implementation defers to the two-party overload, so a test double that
    /// only models per-user membership keeps its existing meaning.
    /// </para>
    /// </summary>
    Task<IReadOnlyList<Conversation>> GetParticipantConversationsAsync(
        string userId,
        bool isAdmin,
        IReadOnlyCollection<string> adminUserIds,
        CancellationToken cancellationToken = default)
    {
        return GetParticipantConversationsAsync(userId, cancellationToken);
    }

    Task<IReadOnlyList<Conversation>> GetParticipantConversationsAsync(
        string userId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<UserDisplayInfo>> GetUserDisplayNamesAsync(
        IReadOnlyCollection<string> userIds,
        CancellationToken cancellationToken = default);

    Task UpsertReadStateAsync(Guid conversationId, string userId, DateTimeOffset lastReadAt, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes one conversation from this participant's own inbox (WESAL-TASK-6, Edit 6).
    ///
    /// Per-user and non-destructive by contract: it records a hide watermark for
    /// (conversationId, userId) and never deletes the conversation, its messages, or
    /// anything belonging to another participant. Hiding the same conversation again
    /// refreshes the watermark, which re-hides a thread that had un-hidden itself through
    /// new activity.
    /// </summary>
    Task HideConversationAsync(Guid conversationId, string userId, DateTimeOffset hiddenAt, CancellationToken cancellationToken = default);

    /// The number of the caller's conversations that hold an unread incoming message.
    ///
    /// <paramref name="isAdmin"/> is part of the signature for two independent reasons. It is a
    /// filtered count, not a plain one: a conversation the caller is not allowed to read must
    /// not be counted, or the badge advertises a thread that cannot be opened, and the filter
    /// is the same hall-messaging gate the inbox list applies, mirrored into LINQ here.
    ///
    /// It also decides <em>who counts as the other party</em> (WESAL-TASK-10, Edit 16). For an
    /// Admin, "the other party" is any non-Admin sender — the owner — not merely "anybody who
    /// is not me". The distinction is not cosmetic: Admin-side chatter is the overwhelming
    /// majority of the traffic in these threads, and counting a colleague's reply as incoming
    /// would leave every Admin's badge permanently lit by their own colleagues.
    /// </summary>
    Task<int> GetUnreadConversationCountAsync(string userId, bool isAdmin, CancellationToken cancellationToken = default);

    /// Per-conversation unread flags for the caller's own inbox rows.
    ///
    /// WESAL-TASK-10, Edit 16: read state stays strictly per-user even though the Admin inbox is
    /// shared, so two Admins can legitimately see the same thread as read and unread at the
    /// same time. Hiding is likewise per-user ("my view of the queue"), which keeps this flag
    /// consistent with the badge for the same caller. The default implementation defers to the
    /// two-party overload, so a test double that does not model Admin sharing is unaffected.
    /// </summary>
    Task<Dictionary<Guid, bool>> GetUnreadStatusAsync(
        string userId,
        bool isAdmin,
        IReadOnlyCollection<string> adminUserIds,
        IReadOnlyCollection<Guid> conversationIds,
        CancellationToken cancellationToken = default)
    {
        return GetUnreadStatusAsync(userId, conversationIds, cancellationToken);
    }

    Task<Dictionary<Guid, bool>> GetUnreadStatusAsync(string userId, IReadOnlyCollection<Guid> conversationIds, CancellationToken cancellationToken = default);

    /// <summary>
    /// How many messages are unread for the caller in each of the given conversations
    /// (WESAL-TASK-10, Edit 14).
    /// <para>
    /// This is the numeric counterpart to the boolean <see cref="GetUnreadStatusAsync(string,
    /// IReadOnlyCollection{Guid}, CancellationToken)"/>, computed from the very same rule so
    /// the two can never disagree: a conversation is unread here exactly when that flag is
    /// true, and it is 0 exactly when the flag is false. A conversation absent from the
    /// returned dictionary therefore means "nothing unread", not "unknown".
    /// </para>
    /// <para>
    /// Like the flag, it is per-user even though the Admin inbox is shared, and it is
    /// deliberately expressed as a count of the OTHER party's messages only, so opening and
    /// reading a thread drains exactly the messages the caller saw arrive.
    /// </para>
    /// </summary>
    Task<Dictionary<Guid, int>> GetUnreadMessageCountsAsync(
        string userId,
        IReadOnlyCollection<Guid> conversationIds,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult(new Dictionary<Guid, int>());
    }

    /// <summary>
    /// The Admin-aware overload of
    /// <see cref="GetUnreadMessageCountsAsync(string, IReadOnlyCollection{Guid}, CancellationToken)"/>,
    /// which decides who counts as the other party: for an Admin that is the hall owner rather
    /// than "anybody who is not me", so a colleague's reply never inflates this Admin's count.
    /// The default implementation defers to the two-party overload, so a test double that does
    /// not model Admin sharing is unaffected.
    /// </summary>
    Task<Dictionary<Guid, int>> GetUnreadMessageCountsAsync(
        string userId,
        bool isAdmin,
        IReadOnlyCollection<string> adminUserIds,
        IReadOnlyCollection<Guid> conversationIds,
        CancellationToken cancellationToken = default)
    {
        return GetUnreadMessageCountsAsync(userId, conversationIds, cancellationToken);
    }
}
