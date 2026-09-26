using Microsoft.AspNetCore.SignalR;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Entities;

namespace Wesal.Infrastructure.Conversations;

/// <summary>
/// Pushes a newly sent message to the people entitled to see it.
/// </summary>
/// <remarks>
/// WESAL-TASK-10 (Edit 10 follow-up). This used to broadcast to the conversation's SignalR
/// group, which reaches every member. A hall owner who was refused the thread, both send
/// paths, the conversation read and the attachment download was still in that group and
/// still received every <c>MessageReceived</c> payload for that thread — so a lock could be
/// applied after they joined and they would keep receiving the conversation anyway.
///
/// A group broadcast cannot exclude a single member, so delivery is resolved per recipient
/// through <see cref="ConversationAccess"/>, the same gate the HTTP endpoints and
/// <c>JoinConversation</c> use. Resolving recipients from the conversation row rather than
/// from group membership also makes this correct on a multi-instance deployment, where the
/// connection being filtered may be held by another instance.
///
/// The trade-off accepted for this: an Admin who is neither party on the conversation row
/// (a moderator watching somebody else's thread) no longer receives live pushes for it. An
/// Admin who IS the counterparty is unaffected, because the counterparty is always delivered
/// to. Moderation can still read the thread over HTTP.
/// </remarks>
public sealed class ConversationNotifier : IConversationNotifier
{
    private readonly IHubContext<ConversationHub> _hubContext;
    private readonly IConversationRepository _conversationRepository;

    public ConversationNotifier(
        IHubContext<ConversationHub> hubContext,
        IConversationRepository conversationRepository)
    {
        _hubContext = hubContext;
        _conversationRepository = conversationRepository;
    }

    public async Task NotifyMessageSentAsync(MessageSentEvent message, CancellationToken cancellationToken = default)
    {
        var conversation = await _conversationRepository.GetByIdWithHallAsync(message.ConversationId, cancellationToken);

        // Fail closed. If the thread or its hall cannot be resolved, nobody has been
        // authorised to receive this and a broadcast would be a guess.
        if (conversation is null || conversation.Hall is null || conversation.Hall.IsDeleted)
        {
            return;
        }

        foreach (var recipient in ResolveRecipients(conversation))
        {
            await _hubContext.Clients
                .User(recipient)
                .SendAsync(ConversationHub.MessageReceived, message, cancellationToken);
        }
    }

    /// <summary>
    /// The conversation's two parties, de-duplicated and filtered through the shared gate.
    /// The hall owner is the only party the gate can ever withhold from, because the gate is
    /// owner-side: the other party is either a seeker or an Admin, and neither is restricted.
    /// </summary>
    private static IEnumerable<string> ResolveRecipients(Conversation conversation)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var candidate in new[] { conversation.SenderUserId, conversation.HallOwnerId })
        {
            if (string.IsNullOrWhiteSpace(candidate) || !seen.Add(candidate))
            {
                continue;
            }

            var isThreadOwner = string.Equals(candidate, conversation.HallOwnerId, StringComparison.OrdinalIgnoreCase);

            // isAdmin is false because the push path cannot see the recipient's roles, and
            // the only recipient this can affect is the hall owner. Erring towards
            // withholding from an owner who also holds the Admin role is the safe direction:
            // such a user can still read and send over HTTP, they simply stop being pushed to.
            if (ConversationAccess.CanAccess(conversation.Hall, isThreadOwner, isAdmin: false))
            {
                yield return candidate;
            }
        }
    }
}
