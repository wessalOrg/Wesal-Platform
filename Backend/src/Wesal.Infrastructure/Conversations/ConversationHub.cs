using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Constants;

namespace Wesal.Infrastructure.Conversations;

[Authorize]
public sealed class ConversationHub : Hub
{
    public const string MessageReceived = "MessageReceived";

    private readonly IConversationRepository _conversationRepository;
    private readonly ICurrentUserService _currentUser;

    public ConversationHub(
        IConversationRepository conversationRepository,
        ICurrentUserService currentUser)
    {
        _conversationRepository = conversationRepository;
        _currentUser = currentUser;
    }

    public async Task JoinConversation(Guid conversationId, CancellationToken cancellationToken = default)
    {
        if (!await IsParticipantAsync(conversationId, cancellationToken))
        {
            throw new HubException("You are not a participant of this conversation.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, conversationId.ToString(), cancellationToken);
    }

    public async Task LeaveConversation(Guid conversationId, CancellationToken cancellationToken = default)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, conversationId.ToString(), cancellationToken);
    }

    private async Task<bool> IsParticipantAsync(Guid conversationId, CancellationToken cancellationToken)
    {
        var userId = _currentUser.UserId;

        if (string.IsNullOrWhiteSpace(userId) || !_currentUser.IsAuthenticated)
        {
            return false;
        }

        var conversation = await _conversationRepository.GetByIdWithHallAsync(conversationId, cancellationToken);

        if (conversation is null || conversation.Hall?.IsDeleted == true)
        {
            return false;
        }

        return string.Equals(userId, conversation.SenderUserId, StringComparison.OrdinalIgnoreCase)
            || string.Equals(userId, conversation.HallOwnerId, StringComparison.OrdinalIgnoreCase)
            || _currentUser.Roles.Contains(ApplicationRoles.Admin, StringComparer.OrdinalIgnoreCase);
    }
}
