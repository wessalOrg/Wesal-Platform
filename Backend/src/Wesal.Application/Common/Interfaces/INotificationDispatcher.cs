using Wesal.Domain.Notifications;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Builds and delivers one notification to one recipient (WESAL-TASK-13, Edit 13).
/// </summary>
public interface INotificationDispatcher
{
    /// <summary>
    /// Renders <paramref name="kind"/> in the recipient's own stored language and pushes
    /// it to that recipient only.
    /// </summary>
    /// <remarks>
    /// Best-effort by contract. A realtime delivery failure is logged and swallowed, so a
    /// booking is never rolled back, and an admin action is never failed, purely because a
    /// browser was offline. Callers that also need a durable record (a conversation
    /// message) write that separately and do not rely on this for persistence.
    /// </remarks>
    Task DispatchAsync(
        NotificationKind kind,
        string recipientUserId,
        IReadOnlyDictionary<string, string?>? values = null,
        string? targetId = null,
        CancellationToken cancellationToken = default);
}
