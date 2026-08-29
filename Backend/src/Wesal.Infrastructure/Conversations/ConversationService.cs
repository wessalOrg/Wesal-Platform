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
    private readonly IMessageRepository _messageRepository;
    private readonly IHallRepository _hallRepository;
    private readonly ICurrentUserService _currentUser;

    public ConversationService(
        IConversationRepository conversationRepository,
        IMessageRepository messageRepository,
        IHallRepository hallRepository,
        ICurrentUserService currentUser)
    {
        _conversationRepository = conversationRepository;
        _messageRepository = messageRepository;
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

    public async Task<IReadOnlyList<ConversationSummaryResponse>> GetMyConversationsAsync(
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var userId = GetAuthenticatedUserId();

        var conversations = await _conversationRepository.GetParticipantConversationsAsync(userId, cancellationToken);

        if (conversations.Count == 0)
        {
            return [];
        }

        var conversationIds = conversations.Select(conversation => conversation.Id).ToList();

        var messages = await _messageRepository.GetByConversationIdsAsync(conversationIds, cancellationToken);

        var latestByConversation = messages
            .GroupBy(message => message.ConversationId)
            .ToDictionary(
                group => group.Key,
                group => group.OrderBy(message => message.CreatedAt).ThenBy(message => message.Id).Last());

        var messageCounts = messages
            .GroupBy(message => message.ConversationId)
            .ToDictionary(group => group.Key, group => group.Count());

        var otherParticipantIds = conversations
            .Select(conversation => OtherParticipantId(conversation, userId))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var nameLookup = (await _conversationRepository.GetUserDisplayNamesAsync(otherParticipantIds, cancellationToken))
            .ToDictionary(info => info.UserId, info => info.FullName, StringComparer.OrdinalIgnoreCase);

        return conversations
            .OrderByDescending(conversation => latestByConversation.GetValueOrDefault(conversation.Id)?.CreatedAt ?? conversation.CreatedAt)
            .ThenByDescending(conversation => conversation.Id)
            .Select(conversation =>
            {
                var latest = latestByConversation.GetValueOrDefault(conversation.Id);
                var otherParticipantId = OtherParticipantId(conversation, userId);

                return new ConversationSummaryResponse
                {
                    ConversationId = conversation.Id,
                    HallId = conversation.HallId,
                    HallName = conversation.Hall?.Name ?? string.Empty,
                    OtherParticipantId = otherParticipantId,
                    OtherParticipantName = nameLookup.GetValueOrDefault(otherParticipantId) ?? string.Empty,
                    LastMessagePreview = latest?.Content ?? string.Empty,
                    LastMessageAt = latest?.CreatedAt,
                    MessageCount = messageCounts.GetValueOrDefault(conversation.Id),
                    CreatedAt = conversation.CreatedAt
                };
            })
            .ToList();
    }

    public async Task<MessageThreadResponse> GetConversationThreadAsync(
        Guid conversationId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var userId = GetAuthenticatedUserId();

        var conversation = await _conversationRepository.GetByIdWithHallAsync(conversationId, cancellationToken);

        if (conversation is null || conversation.Hall?.IsDeleted == true)
        {
            throw new NotFoundException(nameof(Conversation), conversationId);
        }

        var isParticipant = string.Equals(userId, conversation.SenderUserId, StringComparison.OrdinalIgnoreCase)
            || string.Equals(userId, conversation.HallOwnerId, StringComparison.OrdinalIgnoreCase)
            || _currentUser.Roles.Contains(ApplicationRoles.Admin, StringComparer.OrdinalIgnoreCase);

        if (!isParticipant)
        {
            throw new ForbiddenException("You do not have access to this conversation.");
        }

        var messages = await _messageRepository.GetByConversationAsync(conversationId, cancellationToken);

        var senderIds = messages
            .Select(message => message.SenderUserId)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var senderNames = (await _conversationRepository.GetUserDisplayNamesAsync(senderIds, cancellationToken))
            .ToDictionary(info => info.UserId, info => info.FullName, StringComparer.OrdinalIgnoreCase);

        return new MessageThreadResponse
        {
            ConversationId = conversation.Id,
            HallId = conversation.HallId,
            HallName = conversation.Hall?.Name ?? string.Empty,
            Messages = messages
                .Select(message => new MessageDto
                {
                    Id = message.Id,
                    SenderUserId = message.SenderUserId,
                    SenderName = senderNames.GetValueOrDefault(message.SenderUserId) ?? string.Empty,
                    Content = message.Content,
                    SentAt = message.CreatedAt
                })
                .ToList()
        };
    }

    private static string OtherParticipantId(Conversation conversation, string userId)
    {
        return string.Equals(userId, conversation.SenderUserId, StringComparison.OrdinalIgnoreCase)
            ? conversation.HallOwnerId
            : conversation.SenderUserId;
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

    private string GetAuthenticatedUserId()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to access your conversations.");
        }

        return _currentUser.UserId;
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
