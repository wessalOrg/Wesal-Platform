using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IMessageService
{
    Task<MessageDto> SendMessageAsync(Guid conversationId, SendMessageRequest request, CancellationToken cancellationToken = default);
}
