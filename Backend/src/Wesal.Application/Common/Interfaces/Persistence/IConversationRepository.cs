using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IConversationRepository
{
    Task AddAsync(Conversation conversation, CancellationToken cancellationToken = default);

    Task<Conversation?> GetByHallAndUserAsync(Guid hallId, string userId, CancellationToken cancellationToken = default);

    Task<Conversation?> GetByIdWithHallAsync(Guid conversationId, CancellationToken cancellationToken = default);
}
