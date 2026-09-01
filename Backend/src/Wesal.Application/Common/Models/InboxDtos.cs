namespace Wesal.Application.Common.Models;

public sealed class ConversationSummaryResponse
{
    public Guid ConversationId { get; init; }

    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public string OtherParticipantId { get; init; } = string.Empty;

    public string OtherParticipantName { get; init; } = string.Empty;

    public string LastMessagePreview { get; init; } = string.Empty;

    public DateTimeOffset? LastMessageAt { get; init; }

    public int MessageCount { get; init; }

    public DateTimeOffset CreatedAt { get; init; }
}

public sealed class MessageDto
{
    public Guid Id { get; init; }

    public string SenderUserId { get; init; } = string.Empty;

    public string SenderName { get; init; } = string.Empty;

    public string Content { get; init; } = string.Empty;

    public DateTimeOffset SentAt { get; init; }
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
}