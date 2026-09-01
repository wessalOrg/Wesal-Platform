using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.Conversations;

public interface IConversationNotifier
{
    Task NotifyMessageSentAsync(MessageSentEvent message, CancellationToken cancellationToken = default);
}
