using Wesal.Application.Common.Models;
using Wesal.Infrastructure.AiAssistant;

namespace Wesal.Tests.Ai;

public class ChatSessionExchangeShould
{
    [Fact]
    public async Task SaveExchange_StoresUserAndAssistantTurns_WithTheirOwnRoles()
    {
        using var service = new ChatSessionService();
        var session = await service.InitializeSessionAsync("ar");

        await service.SaveExchangeAsync(session.SessionId, "هات قاعات بغزة", "وجدت 2 قاعات", null, null, null);

        var context = await service.GetConversationContextAsync(session.SessionId);
        Assert.Equal(2, context.Turns.Count);
        Assert.Equal("user", context.Turns[0].Role);
        Assert.Equal("assistant", context.Turns[1].Role);
        Assert.Equal("وجدت 2 قاعات", context.Turns[1].Text);
    }

    [Fact]
    public async Task SaveExchange_RemembersShownHallsAndFocusedHall_ForFollowUps()
    {
        using var service = new ChatSessionService();
        var session = await service.InitializeSessionAsync("ar");
        var a = new AiHallRef(Guid.NewGuid(), "A");
        var b = new AiHallRef(Guid.NewGuid(), "B");

        await service.SaveExchangeAsync(session.SessionId, "halls", "here", null, [a, b], b);

        var context = await service.GetConversationContextAsync(session.SessionId);
        Assert.Equal([a, b], context.LastHalls);
        Assert.Equal(b, context.LastHall);
    }

    [Fact]
    public async Task SaveExchange_IsBoundedToSixUserTurns_AndNeverOrphansAReply()
    {
        using var service = new ChatSessionService();
        var session = await service.InitializeSessionAsync("en");

        for (var i = 1; i <= 20; i++)
        {
            await service.SaveExchangeAsync(session.SessionId, $"q{i}", $"a{i}", null, null, null);
        }

        var context = await service.GetConversationContextAsync(session.SessionId);
        Assert.Equal(6, context.Turns.Count(t => t.Role == "user"));
        Assert.Equal(12, context.Turns.Count);
        Assert.Equal("user", context.Turns[0].Role);
        Assert.Equal("q15", context.Turns[0].Text);
        Assert.Equal("a20", context.Turns[^1].Text);
    }

    [Fact]
    public async Task SaveExchange_TruncatesVeryLongAssistantReplies()
    {
        using var service = new ChatSessionService();
        var session = await service.InitializeSessionAsync("en");

        await service.SaveExchangeAsync(session.SessionId, "q", new string('x', 5000), null, null, null);

        var context = await service.GetConversationContextAsync(session.SessionId);
        Assert.True(context.Turns[1].Text.Length <= 600);
    }

    [Fact]
    public async Task SaveExchange_UnknownSession_IsANoOp()
    {
        using var service = new ChatSessionService();

        await service.SaveExchangeAsync(Guid.NewGuid(), "q", "a", null, null, null);

        var context = await service.GetConversationContextAsync(Guid.NewGuid());
        Assert.Empty(context.Turns);
    }

    [Fact]
    public async Task GetConversationContext_ReturnsASnapshot_NotALiveList()
    {
        using var service = new ChatSessionService();
        var session = await service.InitializeSessionAsync("en");
        await service.SaveExchangeAsync(session.SessionId, "q1", "a1", null, null, null);

        var snapshot = await service.GetConversationContextAsync(session.SessionId);
        await service.SaveExchangeAsync(session.SessionId, "q2", "a2", null, null, null);

        Assert.Equal(2, snapshot.Turns.Count);
    }
}
