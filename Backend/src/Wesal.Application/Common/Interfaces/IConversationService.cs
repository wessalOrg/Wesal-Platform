using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IConversationService
{
    Task<ConversationResponse> CreateConversationAsync(Guid hallId, CancellationToken cancellationToken = default);

    Task<ConversationResponse> GetConversationAsync(Guid conversationId, CancellationToken cancellationToken = default);
}
