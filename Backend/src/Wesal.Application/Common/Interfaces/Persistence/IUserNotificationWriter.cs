using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

/// <summary>
/// Writes durably persisted notifications (WESAL coordinator setup, minimum reusable
/// support). Rows written through this port are saved by the caller's unit of work, so
/// a notification can commit in the same transaction as the business state it announces.
/// </summary>
public interface IUserNotificationWriter
{
    Task AddAsync(UserNotification notification, CancellationToken cancellationToken = default);

    async Task<bool> AddOrGroupMessageAsync(UserNotification notification, CancellationToken cancellationToken = default)
    {
        await AddAsync(notification, cancellationToken);
        return true;
    }

    Task MarkConversationReadAsync(string userId, Guid conversationId, DateTimeOffset readAt, CancellationToken cancellationToken = default)
        => Task.CompletedTask;
}
