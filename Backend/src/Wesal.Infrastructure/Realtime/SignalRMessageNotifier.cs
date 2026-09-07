using Microsoft.AspNetCore.SignalR;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.Realtime;

public sealed class SignalRMessageNotifier : IMessageNotifier
{
    private readonly IHubContext<ConversationHub> _hubContext;

    public SignalRMessageNotifier(IHubContext<ConversationHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task NotifyMessageAsync(MessageDto message, Guid conversationId, CancellationToken cancellationToken = default)
    {
        await _hubContext.Clients.Group(conversationId.ToString()).SendAsync("ReceiveMessage", message, cancellationToken);
    }
}
