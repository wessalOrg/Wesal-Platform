using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IConversationRepository
{
    Task<Conversation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<Conversation?> GetByHallAndInitiatorAsync(
        Guid hallId,
        string initiatorUserId,
        CancellationToken cancellationToken = default);

    Task AddAsync(Conversation conversation, CancellationToken cancellationToken = default);
}
