using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IConversationService
{
    Task<ConversationResponse> CreateConversationAsync(Guid hallId, CancellationToken cancellationToken = default);

    Task<ConversationResponse> GetConversationAsync(Guid conversationId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ConversationSummaryResponse>> GetMyConversationsAsync(CancellationToken cancellationToken = default);

    Task<MessageThreadResponse> GetConversationThreadAsync(Guid conversationId, CancellationToken cancellationToken = default);
}
