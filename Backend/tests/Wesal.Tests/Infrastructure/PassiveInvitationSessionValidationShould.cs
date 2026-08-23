using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Infrastructure;

public class PassiveInvitationSessionValidationShould
{
    [Fact]
    public async Task PeekSession_DoesNotRefreshExpiry_PreservesOriginalSession()
    {
        using var service = new ChatSessionService();
        var created = await service.InitializeSessionAsync("ar");
        var originalExpiresAt = created.ExpiresAt;

        // Small delay to ensure time would advance if刷新
        await Task.Delay(10);

        var peeked = await service.PeekSessionAsync(created.SessionId);
        var afterPeek = await service.GetSessionAsync(created.SessionId);

        Assert.NotNull(peeked);
        Assert.Equal(originalExpiresAt, peeked!.ExpiresAt); // Peek must not change expiry
        Assert.NotNull(afterPeek);
        Assert.True(afterPeek!.ExpiresAt > originalExpiresAt); // Get must refresh
    }

    [Fact]
    public async Task PeekSession_ExpiredSession_ReturnsNullWithoutThrowingAndRemoves()
    {
        using var service = new ChatSessionService(TimeSpan.FromHours(1));
        var created = await service.InitializeSessionAsync(null);

        var sessionsField = typeof(ChatSessionService).GetField("_sessions", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;
        var sessions = (System.Collections.Concurrent.ConcurrentDictionary<Guid, ChatSessionService.AiSession>)sessionsField.GetValue(service)!;

        var expired = new ChatSessionService.AiSession
        {
            SessionId = created.SessionId,
            Language = created.Language,
            CreatedAt = created.CreatedAt,
            LastActivityAt = created.CreatedAt,
            ExpiresAt = DateTime.UtcNow.AddMinutes(-1)
        };
        sessions[created.SessionId] = expired;

        var result = await service.PeekSessionAsync(created.SessionId);

        Assert.Null(result);
        Assert.False(sessions.ContainsKey(created.SessionId));
    }

    [Fact]
    public async Task PeekSession_InvalidSessionId_ReturnsNullWithoutThrowing()
    {
        using var service = new ChatSessionService();
        var result = await service.PeekSessionAsync(Guid.NewGuid());
        Assert.Null(result);
    }

    [Fact]
    public async Task PeekSession_MultipleTabs_DoNotCreateInconsistentState()
    {
        using var service = new ChatSessionService();
        var created = await service.InitializeSessionAsync("en");

        // Simulate 5 tabs peeking concurrently
        var tasks = Enumerable.Range(0, 5).Select(_ => service.PeekSessionAsync(created.SessionId)).ToArray();
        var results = await Task.WhenAll(tasks);

        Assert.All(results, r => Assert.NotNull(r));
        Assert.All(results, r => Assert.Equal(created.SessionId, r!.SessionId));

        // Session must still exist and not be corrupted
        var final = await service.GetSessionAsync(created.SessionId);
        Assert.NotNull(final);
        Assert.Equal(created.SessionId, final!.SessionId);
    }

    [Fact]
    public async Task GetSession_ExistingSession_StillWorksAfterPeekValidation()
    {
        using var service = new ChatSessionService();
        var created = await service.InitializeSessionAsync(null);

        var peek = await service.PeekSessionAsync(created.SessionId);
        Assert.NotNull(peek);

        var get = await service.GetSessionAsync(created.SessionId);
        Assert.NotNull(get);
        Assert.Equal(created.SessionId, get!.SessionId);
    }

    [Fact]
    public async Task InitializeSession_DoesNotReplaceExistingSession_OnPeek()
    {
        using var service = new ChatSessionService();
        var session1 = await service.InitializeSessionAsync("ar");
        var session2 = await service.InitializeSessionAsync("ar");

        Assert.NotEqual(session1.SessionId, session2.SessionId);

        var peek1 = await service.PeekSessionAsync(session1.SessionId);
        var peek2 = await service.PeekSessionAsync(session2.SessionId);

        Assert.NotNull(peek1);
        Assert.NotNull(peek2);
        Assert.Equal(session1.SessionId, peek1!.SessionId);
        Assert.Equal(session2.SessionId, peek2!.SessionId);
    }

    [Fact]
    public async Task PeekSession_GuestAndAuthenticatedContexts_HandledViaAllowAnonymous()
    {
        // Current architecture is AllowAnonymous, so both guest and authenticated use same service
        using var service = new ChatSessionService();
        var guestSession = await service.InitializeSessionAsync("ar");
        var authSession = await service.InitializeSessionAsync("en");

        var peekGuest = await service.PeekSessionAsync(guestSession.SessionId);
        var peekAuth = await service.PeekSessionAsync(authSession.SessionId);

        Assert.NotNull(peekGuest);
        Assert.NotNull(peekAuth);
    }

    [Fact]
    public async Task PeekSession_EmptyGuid_ReturnsNullWithoutThrowing()
    {
        using var service = new ChatSessionService();
        var result = await service.PeekSessionAsync(Guid.Empty);
        Assert.Null(result);
    }
}
