using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;
using Microsoft.EntityFrameworkCore;

namespace Wesal.Persistence.Repositories;

/// <summary>
/// EF Core writer for durably persisted notifications (WESAL coordinator setup,
/// minimum reusable support). Adds without saving so the notification commits in the
/// same unit-of-work transaction as the business state it announces.
/// </summary>
public sealed class UserNotificationWriter : IUserNotificationWriter
{
    private readonly ApplicationDbContext _context;

    public UserNotificationWriter(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(UserNotification notification, CancellationToken cancellationToken = default)
        => await _context.UserNotifications.AddAsync(notification, cancellationToken);

    public async Task<bool> AddOrGroupMessageAsync(UserNotification notification, CancellationToken cancellationToken = default)
    {
        if (_context.Database.ProviderName?.Contains("Npgsql", StringComparison.Ordinal) == true)
        {
            var key = $"message-notification:{notification.RecipientUserId}:{notification.ConversationId}:{notification.GroupSenderUserId}";
            await _context.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtext({key}))", cancellationToken);
        }
        var existing = await _context.UserNotifications
            .Where(row => row.Kind == notification.Kind && row.RecipientUserId == notification.RecipientUserId
                && row.ConversationId == notification.ConversationId && row.GroupSenderUserId == notification.GroupSenderUserId
                && row.ReadAt == null)
            .OrderByDescending(row => row.CreatedAt).FirstOrDefaultAsync(cancellationToken);
        if (existing is null)
        {
            await _context.UserNotifications.AddAsync(notification, cancellationToken);
            return true;
        }
        existing.Title = notification.Title;
        existing.Body = notification.Body;
        existing.SenderName = notification.SenderName;
        existing.SenderAvatarUrl = notification.SenderAvatarUrl;
        existing.MessagePreview = notification.MessagePreview;
        existing.MessageCount = checked(existing.MessageCount + 1);
        existing.CreatedAt = notification.CreatedAt;
        return false;
    }

    public async Task MarkConversationReadAsync(string userId, Guid conversationId, DateTimeOffset readAt, CancellationToken cancellationToken = default)
    {
        var unread = await _context.UserNotifications.Where(row => row.RecipientUserId == userId
            && row.ConversationId == conversationId && row.ReadAt == null).ToListAsync(cancellationToken);
        foreach (var notification in unread) notification.ReadAt = readAt;
    }
}
