using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Conversations;

public sealed class ConversationService : IConversationService
{
    private readonly IConversationRepository _conversationRepository;
    private readonly IHallRepository _hallRepository;
    private readonly ICurrentUserService _currentUser;

    public ConversationService(
        IConversationRepository conversationRepository,
        IHallRepository hallRepository,
        ICurrentUserService currentUser)
    {
        _conversationRepository = conversationRepository;
        _hallRepository = hallRepository;
        _currentUser = currentUser;
    }

    public async Task<ConversationResponse> CreateConversationAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        EnsureAuthenticated();
        EnsureRegisteredUserOrHallOwner();

        var hall = await _hallRepository.GetHallByIdAsync(hallId, cancellationToken);

        if (hall is null || hall.IsDeleted || hall.Status != HallStatus.Approved)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        EnsureNotSelfContact(hall);

        var senderUserId = _currentUser.UserId!;

        var conversation = new Conversation
        {
            HallId = hallId,
            SenderUserId = senderUserId,
            HallOwnerId = hall.OwnerId!
        };

        await _conversationRepository.AddAsync(conversation, cancellationToken);

        return new ConversationResponse
        {
            ConversationId = conversation.Id,
            HallId = conversation.HallId,
            HallOwnerId = conversation.HallOwnerId,
            SenderUserId = conversation.SenderUserId,
            CreatedAt = conversation.CreatedAt
        };
    }

    private void EnsureAuthenticated()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to start a conversation.");
        }
    }

    private void EnsureRegisteredUserOrHallOwner()
    {
        if (!_currentUser.Roles.Contains(ApplicationRoles.RegisteredUser, StringComparer.OrdinalIgnoreCase)
            && !_currentUser.Roles.Contains(ApplicationRoles.HallOwner, StringComparer.OrdinalIgnoreCase)
            && !_currentUser.Roles.Contains(ApplicationRoles.Admin, StringComparer.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Only registered users can initiate a conversation.");
        }
    }

    private void EnsureNotSelfContact(Hall hall)
    {
        if (string.Equals(_currentUser.UserId, hall.OwnerId, StringComparison.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("You cannot start a conversation with your own hall.");
        }
    }
}
