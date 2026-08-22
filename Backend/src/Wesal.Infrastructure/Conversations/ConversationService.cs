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

        var existing = await _conversationRepository.GetByHallAndUserAsync(hallId, senderUserId, cancellationToken);

        if (existing is not null)
        {
            return MapToResponse(existing, hall.Name, isExisting: true);
        }

        var conversation = new Conversation
        {
            HallId = hallId,
            SenderUserId = senderUserId,
            HallOwnerId = hall.OwnerId!
        };

        await _conversationRepository.AddAsync(conversation, cancellationToken);

        return MapToResponse(conversation, hall.Name, isExisting: false);
    }

    public async Task<ConversationResponse> GetConversationAsync(
        Guid conversationId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        EnsureAuthenticated();

        var conversation = await _conversationRepository.GetByIdWithHallAsync(conversationId, cancellationToken);

        if (conversation is null)
        {
            throw new NotFoundException(nameof(Conversation), conversationId);
        }

        var userId = _currentUser.UserId!;
        var isParticipant = string.Equals(userId, conversation.SenderUserId, StringComparison.OrdinalIgnoreCase)
            || string.Equals(userId, conversation.HallOwnerId, StringComparison.OrdinalIgnoreCase)
            || _currentUser.Roles.Contains(ApplicationRoles.Admin, StringComparer.OrdinalIgnoreCase);

        if (!isParticipant)
        {
            throw new ForbiddenException("You do not have access to this conversation.");
        }

        return MapToResponse(conversation, conversation.Hall?.Name ?? string.Empty, isExisting: true);
    }

    private static ConversationResponse MapToResponse(Conversation conversation, string hallName, bool isExisting)
    {
        return new ConversationResponse
        {
            ConversationId = conversation.Id,
            HallId = conversation.HallId,
            HallName = hallName,
            InitiatorUserId = conversation.SenderUserId,
            OwnerUserId = conversation.HallOwnerId,
            CreatedAt = conversation.CreatedAt,
            IsExisting = isExisting
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
