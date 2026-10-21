using Wesal.Domain.Enums;

namespace Wesal.Domain.Entities;

/// <summary>
/// A question submitted through the Help Center ("مركز المساعدة") and the Wesal Team's reply.
/// Tickets are user-owned and durable: they must survive a new device/browser, which the
/// previous browser-local store could not do.
/// </summary>
public sealed class HelpTicket
{
    public Guid Id { get; set; }

    /// <summary>The ticket owner. Resolved from the session, never from the request body.</summary>
    public string UserId { get; set; } = string.Empty;

    /// <summary>Display name captured at submit time, so the admin queue can show the asker.</summary>
    public string UserName { get; set; } = string.Empty;

    public string Question { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public HelpTicketStatus Status { get; set; } = HelpTicketStatus.Open;

    /// <summary>The team's answer, or null while the ticket is still open.</summary>
    public string? Reply { get; set; }

    public DateTimeOffset? RepliedAt { get; set; }

    /// <summary>The Admin who answered, for audit; null until a reply exists.</summary>
    public string? RepliedByUserId { get; set; }

    /// <summary>True when a reply arrived and the owner has not opened the ticket since.</summary>
    public bool UserUnread { get; set; }

    /// <summary>
    /// When an Admin last opened the ticket owner's conversation, or null while the ticket is
    /// still unread by the Admin team. Shared across every Admin, so opening the conversation
    /// on any account clears the badge for all of them.
    /// </summary>
    public DateTimeOffset? ReadByAdminAt { get; set; }
}
