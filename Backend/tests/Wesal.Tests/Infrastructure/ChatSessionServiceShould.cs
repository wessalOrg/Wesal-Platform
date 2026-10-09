using Wesal.Application.Common.Models;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

public class ChatSessionServiceShould
{
    [Fact]
    public async Task AuthenticatedSession_IsolatedByOwner_AndRemovedOnLogout()
    {
        using var service = new ChatSessionService();
        var session = await service.InitializeSessionAsync("en", userId: "user-a");
        await service.SaveTurnAsync(session.SessionId, "private to A", null);

        Assert.NotNull(await service.GetSessionAsync(session.SessionId, userId: "user-a"));
        Assert.Null(await service.GetSessionAsync(session.SessionId, userId: "user-b"));
        Assert.Null(await service.GetSessionAsync(session.SessionId));
        Assert.Empty((await service.GetConversationContextAsync(session.SessionId, userId: "user-b")).Turns);

        await service.EndSessionsForUserAsync("user-a");
        Assert.Null(await service.GetSessionAsync(session.SessionId, userId: "user-a"));
    }

    [Fact]
    public async Task GuestSession_IsUnavailableToAuthenticatedUsers()
    {
        using var service = new ChatSessionService();
        var session = await service.InitializeSessionAsync("en");

        Assert.NotNull(await service.GetSessionAsync(session.SessionId));
        Assert.Null(await service.GetSessionAsync(session.SessionId, userId: "user-a"));
    }

    [Fact]
    public async Task InitializeSession_DefaultsLanguageAndExpiresAfterThirtyMinutes()
    {
        using var service = new ChatSessionService();
        var before = DateTime.UtcNow;
        var session = await service.InitializeSessionAsync(" ");
        var after = DateTime.UtcNow;

        Assert.NotEqual(Guid.Empty, session.SessionId);
        Assert.Equal("ar", session.Language);
        Assert.InRange(session.ExpiresAt, before.AddMinutes(30), after.AddMinutes(30));
    }

    [Fact]
    public async Task PeekDoesNotRefreshExpiry_ButGetDoes()
    {
        using var service = new ChatSessionService();
        var created = await service.InitializeSessionAsync("ar");
        var peek = await service.PeekSessionAsync(created.SessionId);
        var refreshed = await service.GetSessionAsync(created.SessionId);

        Assert.Equal(created.ExpiresAt, peek!.ExpiresAt);
        Assert.True(refreshed!.ExpiresAt > created.ExpiresAt);
    }

    [Fact]
    public async Task ExpiredSessionIsDeniedAndPurged()
    {
        var store = new InMemoryAiConversationSessionStore();
        using var service = new ChatSessionService(store);
        var created = await service.InitializeSessionAsync("ar");
        store.SetExpiryForTesting(created.SessionId, DateTimeOffset.UtcNow.AddMinutes(-1));

        Assert.Null(await service.GetSessionAsync(created.SessionId));
        Assert.False(store.ContainsForTesting(created.SessionId));
    }

    [Fact]
    public async Task ContextIncludesBoundedTurnsIntentAndHallReferences()
    {
        using var service = new ChatSessionService();
        var session = await service.InitializeSessionAsync("ar");
        var intent = new AiAssistantIntentDto(AiIntentType.SearchHalls, "Gaza", null, null, 300, null);
        var hall = new AiHallRef(Guid.NewGuid(), "Hall A");

        await service.SaveExchangeAsync(session.SessionId, "دورلي قاعة بغزة لـ300", "لقيت قاعات", intent, [hall], hall);
        var context = await service.GetConversationContextAsync(session.SessionId);

        Assert.Collection(context.Turns,
            turn => { Assert.Equal("user", turn.Role); Assert.Equal("دورلي قاعة بغزة لـ300", turn.Text); },
            turn => { Assert.Equal("assistant", turn.Role); Assert.Equal("لقيت قاعات", turn.Text); });
        Assert.Equal(300, context.LastIntent!.Capacity);
        Assert.Equal(hall, Assert.Single(context.LastHalls!));
        Assert.Equal(hall, context.LastHall);
    }

    [Fact]
    public async Task ConversationHistoryKeepsOnlySixWholeExchanges()
    {
        using var service = new ChatSessionService();
        var session = await service.InitializeSessionAsync("en");

        for (var i = 1; i <= 10; i++)
            await service.SaveExchangeAsync(session.SessionId, $"question {i}", $"reply {i}", null, null, null);

        var context = await service.GetConversationContextAsync(session.SessionId);
        Assert.Equal(12, context.Turns.Count);
        Assert.Equal("question 5", context.Turns[0].Text);
        Assert.Equal("reply 10", context.Turns[^1].Text);
    }

    [Fact]
    public async Task SessionMemoryRedactsCredentialsAndOmitsLongDocumentLikeMessages()
    {
        using var service = new ChatSessionService();
        var session = await service.InitializeSessionAsync("en");

        await service.SaveTurnAsync(session.SessionId, "my token is abc.def", null);
        await service.SaveTurnAsync(session.SessionId, new string('x', 700), null);

        var turns = (await service.GetConversationContextAsync(session.SessionId)).Turns;
        Assert.Contains("[redacted]", turns[0].Text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("abc.def", turns[0].Text, StringComparison.Ordinal);
        Assert.Contains("omitted", turns[1].Text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SeparateServiceInstancesShareDurableStoreAndSerializeConcurrentUpdates()
    {
        var store = new InMemoryAiConversationSessionStore();
        using var firstInstance = new ChatSessionService(store);
        using var secondInstance = new ChatSessionService(store);
        var session = await firstInstance.InitializeSessionAsync("en", userId: "user-a");

        await Task.WhenAll(Enumerable.Range(1, 8).Select(index =>
            (index % 2 == 0 ? firstInstance : secondInstance)
                .SaveTurnAsync(session.SessionId, $"turn {index}", null)));

        var context = await secondInstance.GetConversationContextAsync(session.SessionId, userId: "user-a");
        Assert.Equal(6, context.Turns.Count);
        Assert.Equal(6, context.Turns.Select(turn => turn.Text).Distinct().Count());
    }

    [Fact]
    public async Task EmptyOrUnknownTurnsAreNoOps()
    {
        using var service = new ChatSessionService();
        var session = await service.InitializeSessionAsync(null);
        await service.SaveTurnAsync(session.SessionId, "  ", null);
        await service.SaveTurnAsync(Guid.NewGuid(), "hello", null);

        Assert.Empty((await service.GetConversationContextAsync(session.SessionId)).Turns);
        Assert.Empty((await service.GetConversationContextAsync(Guid.NewGuid())).Turns);
    }
}
