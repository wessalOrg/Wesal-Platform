using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Domain.Entities;
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Admin;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;
using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Persistence;

public sealed class AccountLockRepositoryShould
{
    [Fact]
    public async Task RequestTimeCheckHonorsStartAndEndBoundariesEvenBeforeTheExpiryJobRuns()
    {
        var now = DateTimeOffset.Parse("2026-10-19T12:00:00Z");
        var database = Guid.NewGuid().ToString();
        await using var context = CreateContext(database);
        context.AccountLocks.Add(new UserPublishingRestriction
        {
            Id = Guid.NewGuid(), UserId = "user-1", StartsAt = now.AddHours(-1), EndsAt = now.AddMinutes(1),
            CreatedByAdminId = "admin-1", CreatedAt = now.AddHours(-1)
        });
        await context.SaveChangesAsync();

        var repository = new AccountLockRepository(context);
        Assert.Equal(now.AddMinutes(1), await repository.GetActiveEndsAtAsync("user-1", now));
        Assert.Null(await repository.GetActiveEndsAtAsync("user-1", now.AddMinutes(1)));
    }

    [Fact]
    public async Task ExpiryProcessingPersistsAndDispatchesOneUnlockNotificationExactlyOnce()
    {
        var now = DateTimeOffset.Parse("2026-10-19T12:00:00Z");
        await using var context = CreateContext(Guid.NewGuid().ToString());
        var user = new ApplicationUser { Id = "user-1", UserName = "user-1", NormalizedUserName = "USER-1", FullName = "Locked account" };
        var expired = new UserPublishingRestriction
        {
            Id = Guid.NewGuid(), UserId = user.Id, StartsAt = now.AddHours(-2), EndsAt = now,
            CreatedByAdminId = "admin-1", CreatedAt = now.AddHours(-2)
        };
        context.Users.Add(user);
        context.AccountLocks.Add(expired);
        await context.SaveChangesAsync();

        var notifications = new FakeNotificationService();
        var dispatcher = new RecordingNotificationDispatcher();
        var expiry = new AccountLockExpiryService(new AccountLockRepository(context), new UnitOfWork(context),
            notifications, new UserNotificationWriter(context), dispatcher, new FixedTimeProvider(now),
            NullLogger<AccountLockExpiryService>.Instance);

        Assert.Equal(1, await expiry.ProcessExpiredAsync());
        Assert.Equal(now, (await context.AccountLocks.SingleAsync()).LiftedAt);
        var notification = await context.UserNotifications.SingleAsync();
        Assert.Equal(NotificationKind.AccountUnlocked, notification.Kind);
        Assert.Equal("ar", notification.Language);
        Assert.Equal("تم فك القفل عن حسابك", notification.Title);
        Assert.Single(dispatcher.Dispatches);
        Assert.Equal(NotificationKind.AccountUnlocked, dispatcher.Single().Kind);

        Assert.Equal(0, await expiry.ProcessExpiredAsync());
        Assert.Single(context.UserNotifications);
        Assert.Single(dispatcher.Dispatches);
    }

    private static ApplicationDbContext CreateContext(string databaseName)
        => new(new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(databaseName)
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning)).Options);

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
