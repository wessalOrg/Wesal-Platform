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
        CreateConversationRequest request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var userId = RequireAuthenticatedUser();
        EnsureCanContactHalls();

        var hall = await RequireApprovedHallAsync(request.HallId, cancellationToken);
        if (!string.IsNullOrWhiteSpace(hall.OwnerId)
            && string.Equals(hall.OwnerId, userId, StringComparison.Ordinal))
        {
            throw new ForbiddenException("You cannot start a conversation with your own hall.");
        }

        var existing = await _conversationRepository.GetByHallAndInitiatorAsync(
            hall.Id,
            userId,
            cancellationToken);
        if (existing is not null)
        {
            return Map(existing, hall.Name, isExisting: true);
        }

        var conversation = new Conversation
        {
            HallId = hall.Id,
            InitiatorUserId = userId,
            OwnerUserId = hall.OwnerId ?? string.Empty
        };

        await _conversationRepository.AddAsync(conversation, cancellationToken);
        return Map(conversation, hall.Name, isExisting: false);
    }

    public async Task<ConversationResponse> GetConversationAsync(
        Guid conversationId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var userId = RequireAuthenticatedUser();

        var conversation = await _conversationRepository.GetByIdAsync(conversationId, cancellationToken);
        if (conversation is null)
        {
            throw new NotFoundException(nameof(Conversation), conversationId);
        }

        var isParticipant =
            string.Equals(conversation.InitiatorUserId, userId, StringComparison.Ordinal)
            || string.Equals(conversation.OwnerUserId, userId, StringComparison.Ordinal);
        if (!isParticipant)
        {
            throw new ForbiddenException("You cannot access this conversation.");
        }

        var hall = await _hallRepository.GetHallByIdAsync(conversation.HallId, cancellationToken);
        return Map(conversation, hall?.Name ?? string.Empty, isExisting: true);
    }

    private async Task<Hall> RequireApprovedHallAsync(Guid hallId, CancellationToken cancellationToken)
    {
        var hall = await _hallRepository.GetHallByIdAsync(hallId, cancellationToken);
        if (hall is null || hall.IsDeleted || hall.Status != HallStatus.Approved)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        return hall;
    }

    private string RequireAuthenticatedUser()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to contact a hall owner.");
        }

        return _currentUser.UserId;
    }

    private void EnsureCanContactHalls()
    {
        var allowed =
            _currentUser.Roles.Contains(ApplicationRoles.RegisteredUser, StringComparer.OrdinalIgnoreCase)
            || _currentUser.Roles.Contains(ApplicationRoles.HallOwner, StringComparer.OrdinalIgnoreCase)
            || _currentUser.Roles.Contains(ApplicationRoles.Admin, StringComparer.OrdinalIgnoreCase);

        if (!allowed)
        {
            throw new ForbiddenException("Your account cannot start a conversation with a hall owner.");
        }
    }

    private static ConversationResponse Map(Conversation conversation, string hallName, bool isExisting)
        => new()
        {
            ConversationId = conversation.Id,
            HallId = conversation.HallId,
            HallName = hallName,
            InitiatorUserId = conversation.InitiatorUserId,
            OwnerUserId = conversation.OwnerUserId,
            CreatedAt = conversation.CreatedAt,
            IsExisting = isExisting
        };
}
