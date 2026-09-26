using Wesal.Domain.Notifications;

namespace Wesal.Application.Common.Models;

/// <summary>
/// The payload pushed to a client for one notification (WESAL-TASK-13, Edit 13).
/// </summary>
/// <remarks>
/// Title, body and action label are already localized by the time this exists: the
/// recipient's stored language was applied server-side, so the client renders whatever it
/// receives verbatim and never has to re-translate or guess.
/// </remarks>
public sealed class NotificationEvent
{
    /// <summary>Which trigger this is, so the client can style/route it.</summary>
    public string Kind { get; init; } = string.Empty;

    /// <summary>"ar" or "en" — the recipient's own preference.</summary>
    public string Language { get; init; } = string.Empty;

    public string Title { get; init; } = string.Empty;

    public string Body { get; init; } = string.Empty;

    /// <summary>Click-through label, or null for an informational notification with no action.</summary>
    public string? ActionLabel { get; init; }

    /// <summary>The <see cref="NotificationActionTarget"/> name the action navigates to.</summary>
    public string? ActionTarget { get; init; }

    /// <summary>
    /// The id the action resolves to (conversation/booking/hall), when the action targets
    /// one specific record rather than a general list.
    /// </summary>
    public string? TargetId { get; init; }

    public DateTimeOffset OccurredAt { get; init; }
}
