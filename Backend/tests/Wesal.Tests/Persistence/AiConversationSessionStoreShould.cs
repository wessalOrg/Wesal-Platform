using Microsoft.EntityFrameworkCore;
using Wesal.Domain.Entities;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Persistence;

public sealed class AiConversationSessionStoreShould
{
    [Fact]
    public async Task RepeatedUpdatesDetachTrackedInstancesAndRejectStaleRevisions()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var context = new ApplicationDbContext(options);
        var store = new AiConversationSessionStore(context);
        var now = DateTimeOffset.UtcNow;
        var session = new AiConversationSession
        {
            SessionId = Guid.NewGuid(),
            Language = "en",
            CreatedAt = now,
            LastActivityAt = now,
            ExpiresAt = now.AddMinutes(30),
            TurnsJson = "[]",
            LastHallsJson = "[]"
        };

        await store.AddAsync(session);

        var first = await store.GetAsync(session.SessionId);
        Assert.NotNull(first);
        first!.TurnsJson = "[{\"role\":\"user\",\"content\":\"first\"}]";
        Assert.True(await store.TryUpdateAsync(first, expectedRevision: 0));

        var winner = await store.GetAsync(session.SessionId);
        var stale = await store.GetAsync(session.SessionId);
        Assert.NotNull(winner);
        Assert.NotNull(stale);
        winner!.TurnsJson = "[{\"role\":\"user\",\"content\":\"second\"}]";
        Assert.True(await store.TryUpdateAsync(winner, expectedRevision: 1));

        stale!.TurnsJson = "[{\"role\":\"user\",\"content\":\"stale\"}]";
        Assert.False(await store.TryUpdateAsync(stale, expectedRevision: 1));

        var persisted = await store.GetAsync(session.SessionId);
        Assert.NotNull(persisted);
        Assert.Equal(2, persisted!.Revision);
        Assert.Contains("second", persisted.TurnsJson);
        Assert.DoesNotContain("stale", persisted.TurnsJson);
    }
}
