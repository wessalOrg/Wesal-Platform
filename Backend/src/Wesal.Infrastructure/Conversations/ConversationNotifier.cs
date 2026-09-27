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
/// </para>
/// <para>
/// WESAL-TASK-10, Edit 16 closed exactly that trade-off for the threads where it mattered.
/// A live thread's counterparty is whichever single Admin created or last opened it, so an
/// owner/Admin thread was pushed to one person and invisible to the rest of the team — the
/// gap a shared inbox is about. On those threads delivery is now resolved to the whole Admin
/// role. It is still per recipient and never a group broadcast, because the owner on the same
/// thread remains the member the lock gate has to be able to withhold, which is the reason
/// this class stopped using groups in the first place.
/// </para>
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

        // WESAL-TASK-10, Edit 16: the Admin audience is resolved per notification rather than
        // baked in, so a newly created Admin account is pushed to from its next message on
        // without a redeploy.
        var adminUserIds = await _conversationRepository.GetAdminUserIdsAsync(cancellationToken);

        foreach (var recipient in ResolveRecipients(conversation, adminUserIds))
        {
            await _hubContext.Clients
                .User(recipient)
                .SendAsync(ConversationHub.MessageReceived, message, cancellationToken);
        }
    }

    /// <summary>
    /// Everyone entitled to a live push for this conversation (WESAL-TASK-10, Edit 16).
    /// <para>
    /// For an owner/Admin thread that is the hall owner plus EVERY Admin account, because the
    /// Admin side of the conversation is a role rather than the one individual stored in
    /// <c>SenderUserId</c>. For a seeker/owner thread it is unchanged: the two parties.
    /// </para>
    /// <para>
    /// Still delivered per recipient, never by group broadcast, and the reason has not changed
    /// since Edit 10: a group cannot exclude one member, and the hall owner on an owner/Admin
    /// thread is exactly the member who must be withholdable. The lock gate therefore stays
    /// applied to the owner here, individually, and every Admin — who that gate never restricts
    /// — is resolved and sent to individually. That also keeps this correct on a multi-instance
    /// deployment, where the connection being filtered may be held by another instance.
    /// </para>
    /// <para>
    /// A disconnected Admin is simply not reached: <c>Clients.User</c> on an absent connection
    /// is a no-op, so no connection tracking is needed to mean "every currently-connected
    /// Admin".
    /// </para>
    /// </summary>
    private static IEnumerable<string> ResolveRecipients(
        Conversation conversation,
        IReadOnlyCollection<string> adminUserIds)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        // The hall owner, always individually gated. isAdmin is false because this path cannot
        // see the recipient's roles, and erring towards withholding from an owner who also
        // holds the Admin role is the safe direction: they can still read and send over HTTP.
        if (!string.IsNullOrWhiteSpace(conversation.HallOwnerId)
            && seen.Add(conversation.HallOwnerId)
            && ConversationAccess.CanAccess(conversation.Hall, isThreadOwner: true, isAdmin: false))
        {
            yield return conversation.HallOwnerId;
        }

        if (ConversationAccess.IsAdminThread(conversation, adminUserIds))
        {
            foreach (var adminUserId in adminUserIds)
            {
                // A platform sender is never a delivery target, and the dedupe also covers an
                // owner who happens to hold the Admin role, so nobody is messaged twice.
                if (!string.IsNullOrWhiteSpace(adminUserId) && seen.Add(adminUserId))
                {
                    yield return adminUserId;
                }
            }

            yield break;
        }

        // A seeker/owner thread: the seeker is the only other party and the gate never
        // restricts them, so they are notified exactly as before this change.
        if (!string.IsNullOrWhiteSpace(conversation.SenderUserId) && seen.Add(conversation.SenderUserId))
        {
            yield return conversation.SenderUserId;
        }
    }
}
