using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Exceptions;
using Wesal.Domain.Notifications;

namespace Wesal.Infrastructure.Notifications;

public sealed class NotificationInboxService : INotificationInboxService
{
    private readonly ICurrentUserService _currentUser;
    private readonly IUserNotificationRepository _notifications;
    private readonly IUserNotificationWriter _writer;
    private readonly INotificationService _notificationService;
    private readonly INotificationDispatcher _dispatcher;
    private readonly IUnitOfWork _unitOfWork;
    private readonly TimeProvider _clock;

    public NotificationInboxService(ICurrentUserService currentUser, IUserNotificationRepository notifications,
        IUserNotificationWriter writer, INotificationService notificationService, INotificationDispatcher dispatcher,
        IUnitOfWork unitOfWork, TimeProvider clock)
    {
        _currentUser = currentUser; _notifications = notifications; _writer = writer;
        _notificationService = notificationService; _dispatcher = dispatcher; _unitOfWork = unitOfWork; _clock = clock;
    }

    public async Task<PagedResult<UserNotificationDto>> GetMineAsync(int page, int pageSize, bool unreadOnly, CancellationToken cancellationToken = default)
    {
        var userId = RequireUserId();
        var normalizedPage = page <= 0 ? 1 : page;
        var normalizedSize = pageSize <= 0 ? 10 : Math.Min(pageSize, 100);
        var rows = await _notifications.ListAsync(userId, unreadOnly, (normalizedPage - 1) * normalizedSize, normalizedSize, cancellationToken);
        var total = await _notifications.CountAsync(userId, unreadOnly, cancellationToken);
        return PagedResult<UserNotificationDto>.Create(rows.Select(Map).ToArray(), normalizedPage, normalizedSize, total);
    }

    public Task<int> GetUnreadCountAsync(CancellationToken cancellationToken = default)
        => _notifications.CountAsync(RequireUserId(), true, cancellationToken);

    public async Task<bool> MarkReadAsync(Guid notificationId, CancellationToken cancellationToken = default)
    {
        var notification = await _notifications.GetAsync(RequireUserId(), notificationId, cancellationToken);
        if (notification is null) return false;
        if (notification.ReadAt is null)
        {
            notification.ReadAt = _clock.GetUtcNow();
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }
        return true;
    }

    public Task<int> MarkAllReadAsync(CancellationToken cancellationToken = default)
        => _notifications.MarkAllReadAsync(RequireUserId(), _clock.GetUtcNow(), cancellationToken);

    public async Task CreatePendingReviewNotificationAsync(string userId, bool isPhotographer, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId)) throw new ValidationException("A notification recipient is required.");
        var kind = isPhotographer ? NotificationKind.PhotographerPendingReview : NotificationKind.CoordinatorPendingReview;
        var content = await _notificationService.BuildAsync(kind, userId, cancellationToken: cancellationToken);
        var now = _clock.GetUtcNow();
        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            await _writer.AddAsync(new UserNotification
            {
                Id = Guid.NewGuid(), RecipientUserId = userId, Kind = kind,
                Language = Wesal.Domain.Constants.SupportedLanguages.ToCode(content.Language),
                Title = content.Title, Body = content.Body, ActionLabel = content.ActionLabel,
                ActionTarget = content.ActionTarget, TargetId = content.TargetId, CreatedAt = now
            }, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }, cancellationToken);
        await _dispatcher.DispatchAsync(kind, userId, cancellationToken: cancellationToken);
    }

    private string RequireUserId()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
            throw new UnauthorizedException("You must be logged in to access notifications.");
        return _currentUser.UserId;
    }

    private static UserNotificationDto Map(UserNotification row) => new()
    {
        Id = row.Id, Kind = row.Kind, Title = row.Title, Body = row.Body, CreatedAt = row.CreatedAt,
        ReadAt = row.ReadAt, ActionTarget = row.ActionTarget, TargetId = row.TargetId,
        ConversationId = row.ConversationId, SenderName = row.SenderName,
        SenderAvatarUrl = row.SenderAvatarUrl, MessagePreview = row.MessagePreview, MessageCount = row.MessageCount
    };
}
