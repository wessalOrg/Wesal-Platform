using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IMessageNotifier
{
    Task NotifyMessageAsync(MessageDto message, Guid conversationId, CancellationToken cancellationToken = default);
}
