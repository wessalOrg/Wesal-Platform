namespace Wesal.Application.Common.Models;

public sealed class CreateConversationRequest
{
    public Guid HallId { get; init; }
}

public sealed class SendMessageRequest
{
    public string Content { get; init; } = string.Empty;

    public string? ClientRequestId { get; init; }
}

public sealed class SendMessageResponse
{
    public Guid MessageId { get; init; }

    public Guid ConversationId { get; init; }

    public string SenderUserId { get; init; } = string.Empty;

    public string SenderName { get; init; } = string.Empty;

    public string Content { get; init; } = string.Empty;

    public DateTimeOffset SentAt { get; init; }

    public bool IsDuplicate { get; init; }
}

public sealed class ConversationResponse
{
    public Guid ConversationId { get; init; }

    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public string InitiatorUserId { get; init; } = string.Empty;

    public string OwnerUserId { get; init; } = string.Empty;

    public DateTimeOffset CreatedAt { get; init; }

    public bool IsExisting { get; init; }
}
