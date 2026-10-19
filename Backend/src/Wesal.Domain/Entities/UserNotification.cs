using Wesal.Domain.Enums;
using Wesal.Domain.Notifications;

namespace Wesal.Domain.Entities;

/// <summary>
/// A durably persisted notification (WESAL coordinator setup, minimum reusable support).
///
/// The existing notification pipeline renders content in the recipient's language via
/// <see cref="NotificationCatalog"/> and pushes it over SignalR, but a browser that is
/// offline never receives it. This table stores the rendered notification so important
/// platform events (such as a coordinator's setup submission being received) survive
/// beyond the realtime push. Only the rendered snapshot is stored — no document URLs,
/// no storage keys, no credentials.
/// </summary>
public class UserNotification
{
    public Guid Id { get; set; }

    /// <summary>The user who receives this notification.</summary>
    public string RecipientUserId { get; set; } = string.Empty;

    public NotificationKind Kind { get; set; }

    /// <summary>"ar" or "en" — the language the content was rendered in at send time.</summary>
    public string Language { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    /// <summary>Click-through label, or null for an informational notification.</summary>
    public string? ActionLabel { get; set; }

    public NotificationActionTarget ActionTarget { get; set; }

    /// <summary>The record id the click-through action resolves to, when there is one.</summary>
    public string? TargetId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>Set when the notification has been surfaced as read; null while unread.</summary>
    public DateTimeOffset? ReadAt { get; set; }
}
