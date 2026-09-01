using Microsoft.AspNetCore.SignalR;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.Conversations;

public sealed class ConversationNotifier : IConversationNotifier
{
    private readonly IHubContext<ConversationHub> _hubContext;

    public ConversationNotifier(IHubContext<ConversationHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task NotifyMessageSentAsync(MessageSentEvent message, CancellationToken cancellationToken = default)
    {
        await _hubContext
            .Clients
            .Group(message.ConversationId.ToString())
            .SendAsync(ConversationHub.MessageReceived, message, cancellationToken);
    }
}
