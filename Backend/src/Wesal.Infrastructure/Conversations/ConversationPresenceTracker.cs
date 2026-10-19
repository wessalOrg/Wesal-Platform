using System.Collections.Concurrent;

namespace Wesal.Infrastructure.Conversations;

public sealed class ConversationPresenceTracker : IConversationPresenceTracker
{
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, Guid>> _connections = new(StringComparer.Ordinal);

    public bool IsReading(string userId, Guid conversationId)
        => _connections.TryGetValue(userId, out var connections) && connections.Values.Contains(conversationId);

    public void Open(string userId, string connectionId, Guid conversationId)
        => _connections.GetOrAdd(userId, _ => new ConcurrentDictionary<string, Guid>(StringComparer.Ordinal))[connectionId] = conversationId;

    public void Close(string connectionId, Guid conversationId)
    {
        foreach (var (userId, connections) in _connections)
        {
            if (connections.TryGetValue(connectionId, out var current) && current == conversationId)
                connections.TryRemove(connectionId, out _);
            if (connections.IsEmpty) _connections.TryRemove(userId, out _);
        }
    }

    public void Disconnect(string connectionId)
    {
        foreach (var (userId, connections) in _connections)
        {
            connections.TryRemove(connectionId, out _);
            if (connections.IsEmpty) _connections.TryRemove(userId, out _);
        }
    }

    public void DisconnectUser(string userId) => _connections.TryRemove(userId, out _);
}
