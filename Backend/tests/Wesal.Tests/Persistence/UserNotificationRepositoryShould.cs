using Microsoft.EntityFrameworkCore;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Persistence;

public sealed class UserNotificationRepositoryShould
{
    [Fact]
    public async Task ListsPersistedNotificationsNewestFirstAndScopesReadOperationsToOwner()
    {
        var databaseName = Guid.NewGuid().ToString();
        var firstId = Guid.NewGuid();
        var secondId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        await using (var writeContext = CreateContext(databaseName))
        {
            writeContext.UserNotifications.AddRange(
                Create(firstId, "user-a", now.AddMinutes(-2)),
                Create(secondId, "user-a", now),
                Create(otherId, "user-b", now));
            await writeContext.SaveChangesAsync();
        }

        await using var freshContext = CreateContext(databaseName);
        var repository = new UserNotificationRepository(freshContext);
        var page = await repository.ListAsync("user-a", unreadOnly: true, skip: 0, take: 1);

        Assert.Single(page);
        Assert.Equal(secondId, page[0].Id);
        Assert.Equal(2, await repository.CountAsync("user-a", unreadOnly: true));
        Assert.Null(await repository.GetAsync("user-a", otherId));

        Assert.Equal(2, await repository.MarkAllReadAsync("user-a", now.AddSeconds(1)));
        Assert.Equal(0, await repository.CountAsync("user-a", unreadOnly: true));
        Assert.Equal(1, await repository.CountAsync("user-b", unreadOnly: true));
    }

    private static UserNotification Create(Guid id, string recipient, DateTimeOffset createdAt)
        => new() { Id = id, RecipientUserId = recipient, Title = "title", Body = "body", CreatedAt = createdAt };

    private static ApplicationDbContext CreateContext(string databaseName)
        => new(new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(databaseName).Options);
}
