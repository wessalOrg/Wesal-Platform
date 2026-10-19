using Microsoft.EntityFrameworkCore;
using Wesal.Domain.Entities;
using Wesal.Domain.Notifications;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Persistence;

public sealed class MessageNotificationWriterShould
{
    [Fact]
    public async Task GroupsUnreadMessagesAndStartsANewNotificationAfterRead()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        await using var context = new ApplicationDbContext(options);
        var writer = new UserNotificationWriter(context);
        var conversationId = Guid.NewGuid();

        await writer.AddOrGroupMessageAsync(CreateNotification(conversationId, "first"));
        await context.SaveChangesAsync();
        var grouped = await writer.AddOrGroupMessageAsync(CreateNotification(conversationId, "second"));
        await context.SaveChangesAsync();

        Assert.False(grouped);
        var notification = Assert.Single(context.UserNotifications);
        Assert.Equal(2, notification.MessageCount);
        Assert.Equal("second", notification.MessagePreview);
        Assert.Equal(conversationId.ToString(), notification.TargetId);

        await writer.MarkConversationReadAsync("recipient", conversationId, DateTimeOffset.UtcNow);
        await context.SaveChangesAsync();
        var createdNew = await writer.AddOrGroupMessageAsync(CreateNotification(conversationId, "third"));
        await context.SaveChangesAsync();

        Assert.True(createdNew);
        Assert.Equal(2, await context.UserNotifications.CountAsync());
    }

    private static UserNotification CreateNotification(Guid conversationId, string preview)
        => new()
        {
            Id = Guid.NewGuid(), RecipientUserId = "recipient", Kind = NotificationKind.NewMessage,
            Language = "en", Title = "New message", Body = preview, ActionTarget = NotificationActionTarget.Conversation,
            TargetId = conversationId.ToString(), CreatedAt = DateTimeOffset.UtcNow,
            ConversationId = conversationId, GroupSenderUserId = "sender", SenderName = "Sender",
            MessagePreview = preview, MessageCount = 1
        };
}
