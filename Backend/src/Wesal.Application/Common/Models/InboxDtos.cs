namespace Wesal.Application.Common.Models;

public sealed class ConversationSummaryResponse
{
    public Guid ConversationId { get; init; }

    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public string OtherParticipantId { get; init; } = string.Empty;

    public string OtherParticipantName { get; init; } = string.Empty;

    public string LastMessagePreview { get; init; } = string.Empty;

    /// <summary>
    /// True when the last message in the thread carries an image attachment
    /// (WESAL-TASK-4, Edit 4). The preview text is empty for an attachment-only message,
    /// so this flag is what lets an inbox row render the image indicator.
    /// </summary>
    public bool LastMessageHasAttachment { get; init; }

    public DateTimeOffset? LastMessageAt { get; init; }

    public int MessageCount { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public bool IsUnread { get; init; }
}

public sealed class MessageDto
{
    public Guid Id { get; init; }

    public string SenderUserId { get; init; } = string.Empty;

    public string SenderName { get; init; } = string.Empty;

    /// <summary>Text body; empty for an attachment-only message.</summary>
    public string Content { get; init; } = string.Empty;

    public DateTimeOffset SentAt { get; init; }

    /// <summary>True when this message carries an image attachment (WESAL-TASK-4, Edit 4).</summary>
    public bool HasAttachment { get; init; }

    /// <summary>
    /// Authenticated endpoint that streams the attachment. Only participants of the
    /// conversation may call it; the file is never served from the public static area.
    /// </summary>
    public string? AttachmentUrl { get; init; }

    public string? AttachmentContentType { get; init; }

    public string? AttachmentFileName { get; init; }
}

public sealed class MessageThreadResponse
{
    public Guid ConversationId { get; init; }

    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public IReadOnlyList<MessageDto> Messages { get; init; } = [];
}

public sealed class UserDisplayInfo
{
    public string UserId { get; init; } = string.Empty;

    public string FullName { get; init; } = string.Empty;
}

public sealed class MessageSentEvent
{
    public Guid MessageId { get; init; }

    public Guid ConversationId { get; init; }

    public string SenderUserId { get; init; } = string.Empty;

    public string SenderName { get; init; } = string.Empty;

    public string Content { get; init; } = string.Empty;

    public DateTimeOffset SentAt { get; init; }

    /// <summary>True when the pushed message carries an image attachment (WESAL-TASK-4, Edit 4).</summary>
    public bool HasAttachment { get; init; }

    public string? AttachmentUrl { get; init; }

    public string? AttachmentContentType { get; init; }

    public string? AttachmentFileName { get; init; }
}

public sealed class UnreadCountResponse
{
    public int UnreadCount { get; init; }
}