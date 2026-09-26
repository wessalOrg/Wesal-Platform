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
