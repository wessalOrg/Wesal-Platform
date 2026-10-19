using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;

namespace Wesal.Persistence.Repositories;

public sealed class UserNotificationRepository(ApplicationDbContext context) : IUserNotificationRepository
{
    public async Task<IReadOnlyList<UserNotification>> ListAsync(string userId, bool unreadOnly, int skip, int take, CancellationToken cancellationToken = default)
        => await context.UserNotifications.AsNoTracking().Where(row => row.RecipientUserId == userId && (!unreadOnly || row.ReadAt == null))
            .OrderByDescending(row => row.CreatedAt).ThenByDescending(row => row.Id).Skip(skip).Take(take)
            .ToListAsync(cancellationToken);

    public Task<int> CountAsync(string userId, bool unreadOnly, CancellationToken cancellationToken = default)
        => context.UserNotifications.CountAsync(row => row.RecipientUserId == userId && (!unreadOnly || row.ReadAt == null), cancellationToken);

    public Task<UserNotification?> GetAsync(string userId, Guid notificationId, CancellationToken cancellationToken = default)
        => context.UserNotifications.FirstOrDefaultAsync(row => row.RecipientUserId == userId && row.Id == notificationId, cancellationToken);

    public async Task<int> MarkAllReadAsync(string userId, DateTimeOffset readAt, CancellationToken cancellationToken = default)
    {
        var query = context.UserNotifications.Where(row => row.RecipientUserId == userId && row.ReadAt == null);
        if (context.Database.ProviderName?.Contains("InMemory", StringComparison.Ordinal) == true)
        {
            var rows = await query.ToListAsync(cancellationToken);
            rows.ForEach(row => row.ReadAt = readAt);
            await context.SaveChangesAsync(cancellationToken);
            return rows.Count;
        }
        return await query.ExecuteUpdateAsync(update => update.SetProperty(row => row.ReadAt, readAt), cancellationToken);
    }
}
