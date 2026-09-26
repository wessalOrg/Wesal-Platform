using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Wesal.Infrastructure.Conversations;

[Authorize]
public class ConversationHub : Hub
{
    public const string MessageReceived = "MessageReceived";

    private readonly ConversationThreadGuard _guard;

    public ConversationHub(ConversationThreadGuard guard)
    {
        _guard = guard;
    }

    /// <summary>
    /// WESAL-TASK-10 (Edit 10 follow-up): joining the live group is access to the thread, so
    /// it runs the same rules as the HTTP endpoints. This used to check only membership, which
    /// left a locked hall's owner receiving every live message on a thread they were refused
    /// everywhere else. The rules live in <see cref="ConversationThreadGuard"/> /
    /// <see cref="Domain.Common.ConversationAccess"/> and the business-rule failures are
    /// translated into a <see cref="HubException"/> carrying the same reason code the HTTP
    /// endpoints return, so the client can render the correct locked message.
    /// </summary>
    public async Task JoinConversation(Guid conversationId, CancellationToken cancellationToken = default)
    {
        try
        {
            await _guard.RequireAccessibleThreadAsync(conversationId, cancellationToken);
        }
        catch (Domain.Exceptions.BusinessRuleException ex)
        {
            // SignalR surfaces the exception message to the caller; keep the reason code in it
            // so a locked owner is told WHY rather than a generic "not a participant".
            throw new HubException($"{ex.Code}: {ex.Message}");
        }
        catch (Domain.Exceptions.ForbiddenException ex)
        {
            throw new HubException(ex.Message);
        }
        catch (Domain.Exceptions.NotFoundException)
        {
            throw new HubException("Conversation not found.");
        }
        catch (Domain.Exceptions.UnauthorizedException ex)
        {
            throw new HubException(ex.Message);
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, conversationId.ToString(), cancellationToken);
    }

    public async Task LeaveConversation(Guid conversationId, CancellationToken cancellationToken = default)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, conversationId.ToString(), cancellationToken);
    }
}
