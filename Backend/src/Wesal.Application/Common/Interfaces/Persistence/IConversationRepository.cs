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

    Task<Conversation?> GetByIdWithHallAsync(Guid conversationId, CancellationToken cancellationToken = default);

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

    Task<int> GetUnreadConversationCountAsync(string userId, CancellationToken cancellationToken = default);

    Task<Dictionary<Guid, bool>> GetUnreadStatusAsync(string userId, IReadOnlyCollection<Guid> conversationIds, CancellationToken cancellationToken = default);
}
