using Microsoft.EntityFrameworkCore;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

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
    public async Task LiftsExpiredRestrictionsIdempotentlyAndLeavesFutureRestrictionsActive()
    {
        var now = DateTimeOffset.Parse("2026-10-19T12:00:00Z");
        await using var context = CreateContext(Guid.NewGuid().ToString());
        var expired = new UserPublishingRestriction
        {
            Id = Guid.NewGuid(), UserId = "expired-user", StartsAt = now.AddHours(-2), EndsAt = now,
            CreatedByAdminId = "admin-1", CreatedAt = now.AddHours(-2)
        };
        var future = new UserPublishingRestriction
        {
            Id = Guid.NewGuid(), UserId = "future-user", StartsAt = now, EndsAt = now.AddHours(1),
            CreatedByAdminId = "admin-1", CreatedAt = now
        };
        context.AccountLocks.AddRange(expired, future);
        await context.SaveChangesAsync();
        var repository = new AccountLockRepository(context);

        Assert.Equal(1, await repository.LiftExpiredAsync(now));
        Assert.Equal(0, await repository.LiftExpiredAsync(now));
        Assert.Equal(now, (await context.AccountLocks.SingleAsync(row => row.Id == expired.Id)).LiftedAt);
        Assert.Null((await context.AccountLocks.SingleAsync(row => row.Id == future.Id)).LiftedAt);
    }

    private static ApplicationDbContext CreateContext(string databaseName)
        => new(new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(databaseName).Options);
}
