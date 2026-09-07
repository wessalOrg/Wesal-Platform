using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Conversations;

public sealed class MessageService : IMessageService
{
    private readonly IConversationRepository _conversationRepository;
    private readonly IMessageRepository _messageRepository;
    private readonly ICurrentUserService _currentUser;
    private readonly IMessageNotifier _messageNotifier;
    private readonly IUnitOfWork _unitOfWork;

    public MessageService(
        IConversationRepository conversationRepository,
        IMessageRepository messageRepository,
        ICurrentUserService currentUser,
        IMessageNotifier messageNotifier,
        IUnitOfWork unitOfWork)
    {
        _conversationRepository = conversationRepository;
        _messageRepository = messageRepository;
        _currentUser = currentUser;
        _messageNotifier = messageNotifier;
        _unitOfWork = unitOfWork;
    }

    public async Task<MessageDto> SendMessageAsync(Guid conversationId, SendMessageRequest request, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (string.IsNullOrWhiteSpace(request.Content))
            throw new ValidationException(new Dictionary<string, string[]> { ["Content"] = new[] { "Message content is required." } });

        if (request.Content.Trim().Length > 1000)
            throw new ValidationException(new Dictionary<string, string[]> { ["Content"] = new[] { "Message content cannot exceed 1000 characters." } });

        var userId = GetAuthenticatedUserId();

        var conversation = await _conversationRepository.GetByIdWithHallAsync(conversationId, cancellationToken);
        if (conversation is null)
            throw new NotFoundException(nameof(Conversation), conversationId);

        var isParticipant = string.Equals(userId, conversation.SenderUserId, StringComparison.OrdinalIgnoreCase)
            || string.Equals(userId, conversation.HallOwnerId, StringComparison.OrdinalIgnoreCase)
            || _currentUser.Roles.Any(r => string.Equals(r, Wesal.Domain.Constants.ApplicationRoles.Admin, StringComparison.OrdinalIgnoreCase));

        if (!isParticipant)
            throw new ForbiddenException("You do not have access to this conversation.");

        // Idempotency check
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var existing = await _messageRepository.GetByIdempotencyKeyAsync(conversationId, userId, request.IdempotencyKey.Trim(), cancellationToken);
            if (existing is not null)
            {
                var existingSenderName = await GetSenderNameAsync(existing.SenderUserId, cancellationToken);
                return new MessageDto
                {
                    Id = existing.Id,
                    SenderUserId = existing.SenderUserId,
                    SenderName = existingSenderName,
                    Content = existing.Content,
                    SentAt = existing.CreatedAt
                };
            }
        }

        var sanitized = request.Content.Trim();
        var message = new Message
        {
            ConversationId = conversationId,
            SenderUserId = userId,
            Content = sanitized,
            IdempotencyKey = string.IsNullOrWhiteSpace(request.IdempotencyKey) ? null : request.IdempotencyKey.Trim()
        };

        try
        {
            await _messageRepository.AddAsync(message, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("IdempotencyKey") == true || ex.Message.Contains("IdempotencyKey"))
        {
            // Concurrent duplicate - fetch existing
            var existing = await _messageRepository.GetByIdempotencyKeyAsync(conversationId, userId, request.IdempotencyKey!.Trim(), cancellationToken);
            if (existing is not null)
            {
                var existingSenderName = await GetSenderNameAsync(existing.SenderUserId, cancellationToken);
                return new MessageDto
                {
                    Id = existing.Id,
                    SenderUserId = existing.SenderUserId,
                    SenderName = existingSenderName,
                    Content = existing.Content,
                    SentAt = existing.CreatedAt
                };
            }
            throw;
        }

        var senderName = await GetSenderNameAsync(userId, cancellationToken);
        var dto = new MessageDto
        {
            Id = message.Id,
            SenderUserId = message.SenderUserId,
            SenderName = senderName,
            Content = message.Content,
            SentAt = message.CreatedAt
        };

        // Real-time delivery after successful persistence - best effort
        try
        {
            await _messageNotifier.NotifyMessageAsync(dto, conversationId, cancellationToken);
        }
        catch
        {
            // Swallow - persistence already succeeded, do not create second message
        }

        return dto;
    }

    private string GetAuthenticatedUserId()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
            throw new UnauthorizedException("You must be logged in to send a message.");
        return _currentUser.UserId;
    }

    private async Task<string> GetSenderNameAsync(string userId, CancellationToken cancellationToken)
    {
        var names = await _conversationRepository.GetUserDisplayNamesAsync(new[] { userId }, cancellationToken);
        return names.FirstOrDefault()?.FullName ?? string.Empty;
    }
}
