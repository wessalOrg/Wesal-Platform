using Wesal.Application.Common.Interfaces;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

public class ChatSessionServiceShould
{
    [Fact]
    public async Task InitializeSession_ReturnsNewSessionWithId()
    {
        var service = new ChatSessionService();

        var result = await service.InitializeSessionAsync(null);

        Assert.NotEqual(Guid.Empty, result.SessionId);
        Assert.Equal("ar", result.Language);
        Assert.True(result.ExpiresAt > result.CreatedAt);
    }

    [Fact]
    public async Task InitializeSession_WithEnglishLanguage_ReturnsEnglish()
    {
        var service = new ChatSessionService();

        var result = await service.InitializeSessionAsync("en");

        Assert.Equal("en", result.Language);
    }

    [Fact]
    public async Task InitializeSession_WithArabicLanguage_ReturnsArabic()
    {
        var service = new ChatSessionService();

        var result = await service.InitializeSessionAsync("ar");

        Assert.Equal("ar", result.Language);
    }

    [Fact]
    public async Task InitializeSession_WithNullLanguage_DefaultsToArabic()
    {
        var service = new ChatSessionService();

        var result = await service.InitializeSessionAsync(null);

        Assert.Equal("ar", result.Language);
    }

    [Fact]
    public async Task InitializeSession_WithEmptyLanguage_DefaultsToArabic()
    {
        var service = new ChatSessionService();

        var result = await service.InitializeSessionAsync("");

        Assert.Equal("ar", result.Language);
    }

    [Fact]
    public async Task InitializeSession_WithWhitespaceLanguage_DefaultsToArabic()
    {
        var service = new ChatSessionService();

        var result = await service.InitializeSessionAsync("   ");

        Assert.Equal("ar", result.Language);
    }

    [Fact]
    public async Task InitializeSession_CreatesSession30MinutesFromNow()
    {
        var service = new ChatSessionService();
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
        var service = new ChatSessionService();
        var created = await service.InitializeSessionAsync(null);

        var result = await service.GetSessionAsync(created.SessionId);

        Assert.NotNull(result);
        Assert.Equal(created.SessionId, result!.SessionId);
        Assert.Equal(created.Language, result.Language);
    }

    [Fact]
    public async Task GetSession_NonexistentSession_ReturnsNull()
    {
        var service = new ChatSessionService();

        var result = await service.GetSessionAsync(Guid.NewGuid());

        Assert.Null(result);
    }

    [Fact]
    public async Task GetSession_ExpiredSession_ReturnsNull()
    {
        var service = new ChatSessionService();
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
        var service = new ChatSessionService();
        var created = await service.InitializeSessionAsync(null);

        var result = await service.GetSessionAsync(created.SessionId);

        Assert.NotNull(result);
        Assert.True(result!.ExpiresAt > created.ExpiresAt);
    }

    [Fact]
    public async Task GetSession_RemovesExpiredSessionFromStore()
    {
        var service = new ChatSessionService();
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
        var service = new ChatSessionService();

        var result1 = await service.InitializeSessionAsync(null);
        var result2 = await service.InitializeSessionAsync(null);

        Assert.NotEqual(result1.SessionId, result2.SessionId);
    }
}
