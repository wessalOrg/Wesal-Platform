using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IUserNotificationRepository
{
    Task<IReadOnlyList<UserNotification>> ListAsync(string userId, bool unreadOnly, int skip, int take, CancellationToken cancellationToken = default);
    Task<int> CountAsync(string userId, bool unreadOnly, CancellationToken cancellationToken = default);
    Task<UserNotification?> GetAsync(string userId, Guid notificationId, CancellationToken cancellationToken = default);
    Task<int> MarkAllReadAsync(string userId, DateTimeOffset readAt, CancellationToken cancellationToken = default);
}
