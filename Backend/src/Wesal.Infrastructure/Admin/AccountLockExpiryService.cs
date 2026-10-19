using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Domain.Notifications;

namespace Wesal.Infrastructure.Admin;

/// <summary>Atomically lifts expired locks and persists one unlock notification per affected account.</summary>
public sealed class AccountLockExpiryService(
    IAccountLockRepository locks,
    IUnitOfWork unitOfWork,
    INotificationService notificationService,
    IUserNotificationWriter notificationWriter,
    INotificationDispatcher dispatcher,
    TimeProvider clock,
    ILogger<AccountLockExpiryService> logger) : IAccountLockExpiryService
{
    public async Task<int> ProcessExpiredAsync(string? userId = null, CancellationToken cancellationToken = default)
    {
        var now = clock.GetUtcNow();
        var recipients = await unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            var expired = await locks.GetExpiredForUpdateAsync(now, userId, cancellationToken);
            foreach (var row in expired)
            {
                row.LiftedAt = now;
                var content = await notificationService.BuildAsync(NotificationKind.AccountUnlocked, row.UserId,
                    cancellationToken: cancellationToken);
                await notificationWriter.AddAsync(new UserNotification
                {
                    Id = Guid.NewGuid(), RecipientUserId = row.UserId, Kind = NotificationKind.AccountUnlocked,
                    Language = Wesal.Domain.Constants.SupportedLanguages.ToCode(content.Language), Title = content.Title,
                    Body = content.Body, ActionLabel = content.ActionLabel, ActionTarget = content.ActionTarget,
                    TargetId = content.TargetId, CreatedAt = now
                }, cancellationToken);
            }
            if (expired.Count > 0) await unitOfWork.SaveChangesAsync(cancellationToken);
            return expired.Select(row => row.UserId).Distinct(StringComparer.Ordinal).ToArray();
        }, cancellationToken);

        foreach (var recipient in recipients)
        {
            try
            {
                await dispatcher.DispatchAsync(NotificationKind.AccountUnlocked, recipient, cancellationToken: cancellationToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogWarning(exception, "Account unlock notification realtime dispatch failed.");
            }
        }
        return recipients.Length;
    }
}
