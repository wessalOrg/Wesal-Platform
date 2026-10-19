namespace Wesal.Application.Common.Models;

/// <summary>A Help Center ticket as shown to its owner and to the Admin queue.</summary>
public sealed class HelpTicketDto
{
    public Guid Id { get; init; }

    public string UserId { get; init; } = string.Empty;

    public string UserName { get; init; } = string.Empty;

    public string Question { get; init; } = string.Empty;

    public DateTimeOffset CreatedAt { get; init; }

    /// <summary>"open" or "replied" (lowercase, matching the browser store's shape).</summary>
    public string Status { get; init; } = "open";

    public string? Reply { get; init; }

    public DateTimeOffset? RepliedAt { get; init; }

    /// <summary>True when a reply is waiting to be read by the ticket owner.</summary>
    public bool UserUnread { get; init; }

    /// <summary>
    /// True while no Admin has opened the owner's conversation since this question arrived, so
    /// the Admin queue can group questions per owner and badge the ones still unread.
    /// </summary>
    public bool AdminUnread { get; init; }
}

/// <summary>
/// A new Help Center question. There is deliberately no owner id: the owner is resolved from
/// the authenticated session, so a client cannot file a ticket as somebody else.
/// </summary>
public sealed class CreateHelpTicketRequestDto
{
    /// <summary>Display name to show the team; falls back to a neutral label when blank.</summary>
    public string? UserName { get; init; }

    public string Question { get; init; } = string.Empty;
}

public sealed class ReplyHelpTicketRequestDto
{
    public string Reply { get; init; } = string.Empty;
}
