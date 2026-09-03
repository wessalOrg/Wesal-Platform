using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

public class ChatSessionServiceShould
{
    [Fact]
    public async Task InitializeSession_ReturnsNewSessionWithId()
    {
        using var service = new ChatSessionService();

        var result = await service.InitializeSessionAsync(null);

        Assert.NotEqual(Guid.Empty, result.SessionId);
        Assert.Equal("ar", result.Language);
        Assert.True(result.ExpiresAt > result.CreatedAt);
    }

    [Fact]
    public async Task InitializeSession_WithEnglishLanguage_ReturnsEnglish()
    {
        using var service = new ChatSessionService();

        var result = await service.InitializeSessionAsync("en");

        Assert.Equal("en", result.Language);
    }

    [Fact]
    public async Task InitializeSession_WithArabicLanguage_ReturnsArabic()
    {
        using var service = new ChatSessionService();

        var result = await service.InitializeSessionAsync("ar");

        Assert.Equal("ar", result.Language);
    }

    [Fact]
    public async Task InitializeSession_WithNullLanguage_DefaultsToArabic()
    {
        using var service = new ChatSessionService();

        var result = await service.InitializeSessionAsync(null);

        Assert.Equal("ar", result.Language);
    }

    [Fact]
    public async Task InitializeSession_WithEmptyLanguage_DefaultsToArabic()
    {
        using var service = new ChatSessionService();

        var result = await service.InitializeSessionAsync("");

        Assert.Equal("ar", result.Language);
    }

    [Fact]
    public async Task InitializeSession_WithWhitespaceLanguage_DefaultsToArabic()
    {
        using var service = new ChatSessionService();

        var result = await service.InitializeSessionAsync("   ");

        Assert.Equal("ar", result.Language);
    }

    [Fact]
    public async Task InitializeSession_CreatesSession30MinutesFromNow()
    {
        using var service = new ChatSessionService();
        var before = DateTime.UtcNow;

        var result = await service.InitializeSessionAsync(null);
        var after = DateTime.UtcNow;

        var expectedMin = before.AddMinutes(30);
        var expectedMax = after.AddMinutes(30);
        Assert.True(result.ExpiresAt >= expectedMin && result.ExpiresAt <= expectedMax);
    }

    [Fact]
    public async Task GetSession_ExistingSession_ReturnsSession()
    {
        using var service = new ChatSessionService();
        var created = await service.InitializeSessionAsync(null);

        var result = await service.GetSessionAsync(created.SessionId);

        Assert.NotNull(result);
        Assert.Equal(created.SessionId, result!.SessionId);
        Assert.Equal(created.Language, result.Language);
    }

    [Fact]
    public async Task GetSession_NonexistentSession_ReturnsNull()
    {
        using var service = new ChatSessionService();

        var result = await service.GetSessionAsync(Guid.NewGuid());

        Assert.Null(result);
    }

    [Fact]
    public async Task GetSession_ExpiredSession_ReturnsNull()
    {
        using var service = new ChatSessionService();
        var created = await service.InitializeSessionAsync(null);

        var expiredSession = new ChatSessionService.AiSession
        {
            SessionId = created.SessionId,
            Language = created.Language,
            CreatedAt = created.CreatedAt,
            LastActivityAt = created.CreatedAt,
            ExpiresAt = DateTime.UtcNow.AddMinutes(-1)
        };

        var sessionsField = typeof(ChatSessionService)
            .GetField("_sessions", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;
        var sessions = (System.Collections.Concurrent.ConcurrentDictionary<Guid, ChatSessionService.AiSession>)sessionsField.GetValue(service)!;
        sessions[created.SessionId] = expiredSession;

        var result = await service.GetSessionAsync(created.SessionId);

        Assert.Null(result);
    }

    [Fact]
    public async Task GetSession_ActiveSession_RefreshesExpiry()
    {
        using var service = new ChatSessionService();
        var created = await service.InitializeSessionAsync(null);

        var result = await service.GetSessionAsync(created.SessionId);

        Assert.NotNull(result);
        Assert.True(result!.ExpiresAt > created.ExpiresAt);
    }

    [Fact]
    public async Task GetSession_RemovesExpiredSessionFromStore()
    {
        using var service = new ChatSessionService();
        var created = await service.InitializeSessionAsync(null);

        var expiredSession = new ChatSessionService.AiSession
        {
            SessionId = created.SessionId,
            Language = created.Language,
            CreatedAt = created.CreatedAt,
            LastActivityAt = created.CreatedAt,
            ExpiresAt = DateTime.UtcNow.AddMinutes(-1)
        };

        var sessionsField = typeof(ChatSessionService)
            .GetField("_sessions", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;
        var sessions = (System.Collections.Concurrent.ConcurrentDictionary<Guid, ChatSessionService.AiSession>)sessionsField.GetValue(service)!;
        sessions[created.SessionId] = expiredSession;

        await service.GetSessionAsync(created.SessionId);

        Assert.False(sessions.ContainsKey(created.SessionId));
    }

    [Fact]
    public async Task InitializeSession_MultipleCalls_ReturnsDifferentSessionIds()
    {
        using var service = new ChatSessionService();

        var result1 = await service.InitializeSessionAsync(null);
        var result2 = await service.InitializeSessionAsync(null);

        Assert.NotEqual(result1.SessionId, result2.SessionId);
    }

    [Fact]
    public void SweepExpiredSessions_RemovesExpiredSessions()
    {
        using var service = new ChatSessionService(TimeSpan.FromHours(1));

        var sessionsField = typeof(ChatSessionService)
            .GetField("_sessions", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;
        var sessions = (System.Collections.Concurrent.ConcurrentDictionary<Guid, ChatSessionService.AiSession>)sessionsField.GetValue(service)!;

        var expiredSession = new ChatSessionService.AiSession
        {
            SessionId = Guid.NewGuid(),
            Language = "ar",
            CreatedAt = DateTime.UtcNow.AddMinutes(-60),
            LastActivityAt = DateTime.UtcNow.AddMinutes(-60),
            ExpiresAt = DateTime.UtcNow.AddMinutes(-1)
        };
        sessions[expiredSession.SessionId] = expiredSession;

        service.SweepExpiredSessions();

        Assert.False(sessions.ContainsKey(expiredSession.SessionId));
    }

    [Fact]
    public void SweepExpiredSessions_PreservesActiveSessions()
    {
        using var service = new ChatSessionService(TimeSpan.FromHours(1));

        var sessionsField = typeof(ChatSessionService)
            .GetField("_sessions", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;
        var sessions = (System.Collections.Concurrent.ConcurrentDictionary<Guid, ChatSessionService.AiSession>)sessionsField.GetValue(service)!;

        var activeSession = new ChatSessionService.AiSession
        {
            SessionId = Guid.NewGuid(),
            Language = "ar",
            CreatedAt = DateTime.UtcNow,
            LastActivityAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddMinutes(30)
        };
        sessions[activeSession.SessionId] = activeSession;

        service.SweepExpiredSessions();

        Assert.True(sessions.ContainsKey(activeSession.SessionId));
    }

    [Fact]
    public void SweepExpiredSessions_EmptyStore_DoesNotThrow()
    {
        using var service = new ChatSessionService(TimeSpan.FromHours(1));

        var exception = Record.Exception(() => service.SweepExpiredSessions());

        Assert.Null(exception);
    }

    [Fact]
    public void SweepExpiredSessions_MixedSessions_RemovesOnlyExpired()
    {
        using var service = new ChatSessionService(TimeSpan.FromHours(1));

        var sessionsField = typeof(ChatSessionService)
            .GetField("_sessions", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;
        var sessions = (System.Collections.Concurrent.ConcurrentDictionary<Guid, ChatSessionService.AiSession>)sessionsField.GetValue(service)!;

        var expired1 = new ChatSessionService.AiSession
        {
            SessionId = Guid.NewGuid(),
            Language = "ar",
            CreatedAt = DateTime.UtcNow.AddMinutes(-60),
            LastActivityAt = DateTime.UtcNow.AddMinutes(-60),
            ExpiresAt = DateTime.UtcNow.AddMinutes(-10)
        };
        var expired2 = new ChatSessionService.AiSession
        {
            SessionId = Guid.NewGuid(),
            Language = "en",
            CreatedAt = DateTime.UtcNow.AddMinutes(-45),
            LastActivityAt = DateTime.UtcNow.AddMinutes(-45),
            ExpiresAt = DateTime.UtcNow.AddMinutes(-5)
        };
        var active = new ChatSessionService.AiSession
        {
            SessionId = Guid.NewGuid(),
            Language = "ar",
            CreatedAt = DateTime.UtcNow,
            LastActivityAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddMinutes(25)
        };

        sessions[expired1.SessionId] = expired1;
        sessions[expired2.SessionId] = expired2;
        sessions[active.SessionId] = active;

        service.SweepExpiredSessions();

        Assert.False(sessions.ContainsKey(expired1.SessionId));
        Assert.False(sessions.ContainsKey(expired2.SessionId));
        Assert.True(sessions.ContainsKey(active.SessionId));
        Assert.Single(sessions);
    }

    [Fact]
    public void Dispose_StopsTimer()
    {
        var service = new ChatSessionService(TimeSpan.FromMilliseconds(50));

        var disposeException = Record.Exception(() => service.Dispose());

        Assert.Null(disposeException);
    }

    [Fact]
    public async Task SaveTurn_ThenGetContext_ReturnsTurnAndIntent()
    {
        using var service = new ChatSessionService();
        var session = await service.InitializeSessionAsync(null);
        var intent = new AiAssistantIntentDto(
            AiIntentType.SearchHalls, "Gaza", null, null, null, 300, null);

        await service.SaveTurnAsync(session.SessionId, "أريد قاعة في غزة لـ 300 شخص", intent);
        var context = await service.GetConversationContextAsync(session.SessionId);

        Assert.Single(context.Turns);
        Assert.Equal("user", context.Turns[0].Role);
        Assert.Equal("أريد قاعة في غزة لـ 300 شخص", context.Turns[0].Text);
        Assert.NotNull(context.LastIntent);
        Assert.Equal(AiIntentType.SearchHalls, context.LastIntent!.Intent);
        Assert.Equal(300, context.LastIntent!.Capacity);
    }

    [Fact]
    public async Task SaveTurn_MultipleTurns_BoundedToLimit()
    {
        using var service = new ChatSessionService();
        var session = await service.InitializeSessionAsync(null);

        for (var i = 1; i <= 10; i++)
        {
            await service.SaveTurnAsync(session.SessionId, $"message {i}", null);
        }

        var context = await service.GetConversationContextAsync(session.SessionId);

        Assert.Equal(6, context.Turns.Count);
        Assert.Equal("message 5", context.Turns[0].Text);
        Assert.Equal("message 10", context.Turns[^1].Text);
    }

    [Fact]
    public async Task SaveTurn_EmptyMessage_DoesNotRecord()
    {
        using var service = new ChatSessionService();
        var session = await service.InitializeSessionAsync(null);

        await service.SaveTurnAsync(session.SessionId, "   ", null);
        var context = await service.GetConversationContextAsync(session.SessionId);

        Assert.Empty(context.Turns);
    }

    [Fact]
    public async Task SaveTurn_MissingSession_NoOp()
    {
        using var service = new ChatSessionService();

        await service.SaveTurnAsync(Guid.NewGuid(), "hello", null);
        var context = await service.GetConversationContextAsync(Guid.NewGuid());

        Assert.Empty(context.Turns);
        Assert.Null(context.LastIntent);
    }

    [Fact]
    public async Task GetContext_ExpiredSession_ReturnsEmpty()
    {
        using var service = new ChatSessionService();
        var created = await service.InitializeSessionAsync(null);

        var expiredSession = new ChatSessionService.AiSession
        {
            SessionId = created.SessionId,
            Language = created.Language,
            CreatedAt = created.CreatedAt,
            LastActivityAt = created.CreatedAt,
            ExpiresAt = DateTime.UtcNow.AddMinutes(-1)
        };

        var sessionsField = typeof(ChatSessionService)
            .GetField("_sessions", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;
        var sessions = (System.Collections.Concurrent.ConcurrentDictionary<Guid, ChatSessionService.AiSession>)sessionsField.GetValue(service)!;
        sessions[created.SessionId] = expiredSession;

        var context = await service.GetConversationContextAsync(created.SessionId);

        Assert.Empty(context.Turns);
        Assert.Null(context.LastIntent);
    }
}
