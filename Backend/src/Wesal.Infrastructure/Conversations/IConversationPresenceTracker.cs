namespace Wesal.Infrastructure.Conversations;

public interface IConversationPresenceTracker
{
    bool IsReading(string userId, Guid conversationId);
    void Open(string userId, string connectionId, Guid conversationId);
    void Close(string connectionId, Guid conversationId);
    void Disconnect(string connectionId);
}
