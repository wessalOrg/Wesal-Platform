using Wesal.Infrastructure.Conversations;

namespace Wesal.Tests.Infrastructure;

public sealed class ConversationPresenceTrackerShould
{
    [Fact]
    public void TracksOpenConversationsAcrossConnectionsAndRemovesDisconnectedConnections()
    {
        var tracker = new ConversationPresenceTracker();
        var conversationId = Guid.NewGuid();
        tracker.Open("user", "connection-1", conversationId);
        tracker.Open("user", "connection-2", conversationId);

        Assert.True(tracker.IsReading("user", conversationId));
        tracker.Close("connection-1", conversationId);
        Assert.True(tracker.IsReading("user", conversationId));
        tracker.Disconnect("connection-2");
        Assert.False(tracker.IsReading("user", conversationId));
    }
}
