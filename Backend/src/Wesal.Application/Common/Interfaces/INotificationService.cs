using Wesal.Domain.Enums;
using Wesal.Domain.Notifications;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Builds localized, ready-to-send notification content (WESAL-TASK-13, Edit 13).
/// </summary>
public interface INotificationService
{
    /// <summary>
    /// Renders <paramref name="kind"/> in <b>the recipient's own</b> stored language
    /// preference, never the sender's or the acting Admin's locale.
    /// </summary>
    /// <param name="kind">Which notification to render.</param>
    /// <param name="recipientUserId">The user who will receive it; their stored preference decides the language.</param>
    /// <param name="values">Placeholder token values, keyed by <see cref="NotificationTokens"/>.</param>
    /// <param name="targetId">Conversation/booking/hall id the click-through action resolves to, when the action needs one.</param>
    Task<NotificationContent> BuildAsync(
        NotificationKind kind,
        string recipientUserId,
        IReadOnlyDictionary<string, string?>? values = null,
        string? targetId = null,
        CancellationToken cancellationToken = default);
}
