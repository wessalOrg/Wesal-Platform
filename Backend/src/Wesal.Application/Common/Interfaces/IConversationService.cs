using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IConversationService
{
    Task<ConversationResponse> CreateConversationAsync(
        CreateConversationRequest request,
        CancellationToken cancellationToken = default);

    Task<ConversationResponse> GetConversationAsync(
        Guid conversationId,
        CancellationToken cancellationToken = default);
}
