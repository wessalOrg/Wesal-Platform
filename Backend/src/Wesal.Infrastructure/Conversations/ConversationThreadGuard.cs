using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Conversations;

/// <summary>
/// Resolves a conversation for a caller and applies the shared access rules
/// (<see cref="ConversationAccess"/>) to it. WESAL-TASK-10 (Edit 10 follow-up).
///
/// <para>
/// The SignalR hub used to carry its own, weaker copy of the participant rule and no copy of
/// the hall-messaging rule at all, so an owner whose hall was Admin-locked or system-locked
/// was refused the thread over HTTP, refused both send paths, refused the conversation read
/// and the attachment download — and could still join the live group and receive every
/// <c>MessageReceived</c> payload. This type is the single place a transport asks "may this
/// caller be in this thread right now?", so the HTTP service and the hub cannot disagree.
/// </para>
/// </summary>
public sealed class ConversationThreadGuard
{
    private readonly IConversationRepository _conversationRepository;
    private readonly ICurrentUserService _currentUser;

    public ConversationThreadGuard(
        IConversationRepository conversationRepository,
        ICurrentUserService currentUser)
    {
        _conversationRepository = conversationRepository;
        _currentUser = currentUser;
    }

    /// <summary>
    /// Loads the conversation and enforces, in order: authenticated, thread exists, hall not
    /// deleted, caller is a participant, and the hall-messaging gate for this hall's owner.
    /// Throws <see cref="UnauthorizedException"/>, <see cref="NotFoundException"/>,
    /// <see cref="ForbiddenException"/> or <see cref="BusinessRuleException"/>.
    /// </summary>
    public async Task<Conversation> RequireAccessibleThreadAsync(
        Guid conversationId,
        CancellationToken cancellationToken = default)
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to take part in a conversation.");
        }

        var conversation = await _conversationRepository.GetByIdWithHallAsync(conversationId, cancellationToken);

        if (conversation is null || conversation.Hall?.IsDeleted == true)
        {
            throw new NotFoundException(nameof(Conversation), conversationId);
        }

        var isAdmin = _currentUser.Roles.Contains(ApplicationRoles.Admin, StringComparer.OrdinalIgnoreCase);

        if (!ConversationAccess.IsParticipant(conversation, _currentUser.UserId, isAdmin))
        {
            throw new ForbiddenException("You do not have access to this conversation.");
        }

        ConversationAccess.EnsureOwnerMessagingAccess(
            conversation.Hall,
            isThreadOwner: string.Equals(_currentUser.UserId, conversation.HallOwnerId, StringComparison.OrdinalIgnoreCase),
            isAdmin: isAdmin);

        return conversation;
    }

    /// <summary>
    /// Whether the caller may currently receive live messages for this conversation. Same
    /// rule as <see cref="RequireAccessibleThreadAsync"/>, expressed as a predicate for the
    /// push path, which must quietly withhold a message rather than fault a connection.
    /// </summary>
    public async Task<bool> CanReceiveLiveMessagesAsync(
        Guid conversationId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await RequireAccessibleThreadAsync(conversationId, cancellationToken);
            return true;
        }
        catch (Exception ex) when (ex is UnauthorizedException
            or NotFoundException
            or ForbiddenException
            or BusinessRuleException)
        {
            return false;
        }
    }
}
