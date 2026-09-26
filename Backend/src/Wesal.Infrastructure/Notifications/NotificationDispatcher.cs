using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Notifications;

namespace Wesal.Infrastructure.Notifications;

/// <summary>
/// Default <see cref="INotificationDispatcher"/> (WESAL-TASK-13, Edit 13): localizes via
/// <see cref="INotificationService"/> and pushes via <see cref="INotificationNotifier"/>.
/// </summary>
public sealed class NotificationDispatcher : INotificationDispatcher
{
    private readonly INotificationService _notificationService;
    private readonly INotificationNotifier _notifier;
    private readonly IDateTime _dateTime;
    private readonly ILogger<NotificationDispatcher> _logger;

    public NotificationDispatcher(
        INotificationService notificationService,
        INotificationNotifier notifier,
        IDateTime dateTime,
        ILogger<NotificationDispatcher> logger)
    {
        _notificationService = notificationService;
        _notifier = notifier;
        _dateTime = dateTime;
        _logger = logger;
    }

    public async Task DispatchAsync(
        NotificationKind kind,
        string recipientUserId,
        IReadOnlyDictionary<string, string?>? values = null,
        string? targetId = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(recipientUserId))
        {
            _logger.LogWarning("Skipping {NotificationKind}: no recipient could be resolved", kind);
            return;
        }

        try
        {
            var content = await _notificationService.BuildAsync(
                kind,
                recipientUserId,
                values,
                targetId,
                cancellationToken);

            var notification = new NotificationEvent
            {
                Kind = content.Kind.ToString(),
                Language = SupportedLanguages.ToCode(content.Language),
                Title = content.Title,
                Body = content.Body,
                ActionLabel = content.ActionLabel,
                ActionTarget = content.ActionTarget == NotificationActionTarget.None
                    ? null
                    : content.ActionTarget.ToString(),
                TargetId = content.TargetId,
                OccurredAt = _dateTime.Now
            };

            await _notifier.NotifyAsync(recipientUserId, notification, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            // Never let a notification problem fail the business action that triggered it.
            _logger.LogWarning(
                ex,
                "Failed to dispatch {NotificationKind} to user {RecipientUserId}",
                kind,
                recipientUserId);
        }
    }
}
