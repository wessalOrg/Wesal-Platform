using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Interfaces;

namespace Wesal.Infrastructure.Realtime;

[Authorize]
public sealed class ConversationHub : Hub
{
    private readonly IConversationRepository _conversationRepository;
    private readonly ICurrentUserService _currentUser;

    public ConversationHub(IConversationRepository conversationRepository, ICurrentUserService currentUser)
    {
        _conversationRepository = conversationRepository;
        _currentUser = currentUser;
    }

    public async Task JoinConversation(Guid conversationId)
    {
        var userId = _currentUser.UserId;
        if (string.IsNullOrWhiteSpace(userId))
        {
            Context.Abort();
            return;
        }

        var conversation = await _conversationRepository.GetByIdWithHallAsync(conversationId);
        if (conversation is null) return;

        var isParticipant = string.Equals(userId, conversation.SenderUserId, StringComparison.OrdinalIgnoreCase)
            || string.Equals(userId, conversation.HallOwnerId, StringComparison.OrdinalIgnoreCase)
            || _currentUser.Roles.Any(r => string.Equals(r, Wesal.Domain.Constants.ApplicationRoles.Admin, StringComparison.OrdinalIgnoreCase));

        if (!isParticipant) return;

        await Groups.AddToGroupAsync(Context.ConnectionId, conversationId.ToString());
    }

    public async Task LeaveConversation(Guid conversationId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, conversationId.ToString());
    }
}
