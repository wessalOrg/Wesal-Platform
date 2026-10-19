using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface INotificationInboxService
{
    Task<PagedResult<UserNotificationDto>> GetMineAsync(int page, int pageSize, bool unreadOnly, CancellationToken cancellationToken = default);
    Task<int> GetUnreadCountAsync(CancellationToken cancellationToken = default);
    Task<bool> MarkReadAsync(Guid notificationId, CancellationToken cancellationToken = default);
    Task<int> MarkAllReadAsync(CancellationToken cancellationToken = default);
    Task CreatePendingReviewNotificationAsync(string userId, bool isPhotographer, CancellationToken cancellationToken = default);
}
