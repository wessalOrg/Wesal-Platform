using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IMessageRepository
{
    Task AddAsync(Message message, CancellationToken cancellationToken = default);

    Task SaveChangesAsync(CancellationToken cancellationToken = default);

    Task<Message?> GetByClientRequestIdAsync(
        string senderUserId,
        string clientRequestId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Loads a single message of a conversation (WESAL-TASK-4, Edit 4), used to serve a
    /// message's protected image attachment to a conversation participant.
    /// </summary>
    Task<Message?> GetByIdAsync(Guid messageId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Message>> GetByConversationAsync(
        Guid conversationId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Message>> GetByConversationIdsAsync(
        IReadOnlyCollection<Guid> conversationIds,
        CancellationToken cancellationToken = default);
}