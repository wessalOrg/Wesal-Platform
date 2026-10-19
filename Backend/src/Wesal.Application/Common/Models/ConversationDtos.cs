namespace Wesal.Application.Common.Models;

using Wesal.Domain.Enums;

public sealed class CreateConversationRequest
{
    public Guid HallId { get; init; }
}

public sealed class SendMessageRequest
{
    public string Content { get; init; } = string.Empty;

    public string? ClientRequestId { get; init; }
    public Guid? ContextPostId { get; init; }
    public Guid? ContextOfferId { get; init; }
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

    /// <summary>True when the sent message carries an image attachment (WESAL-TASK-4, Edit 4).</summary>
    public bool HasAttachment { get; init; }

    public string? AttachmentUrl { get; init; }

    public string? AttachmentContentType { get; init; }

    public string? AttachmentFileName { get; init; }
    public Guid? ContextPostId { get; init; }
    public Guid? ContextOfferId { get; init; }
    public string? ContextTitle { get; init; }
    public string? ContextText { get; init; }
    public string? ContextImageUrl { get; init; }
    public string? ContextOwnerUserId { get; init; }
    public bool? ContextItemAvailable { get; init; }
}

public sealed class ConversationResponse
{
    public Guid ConversationId { get; init; }

    /// <summary>
    /// The hall this thread concerns, or null for a hall-less Admin request thread
    /// (WESAL admin coordinator/photographer requests, Tasks 5/6).
    /// </summary>
    public Guid? HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public string InitiatorUserId { get; init; } = string.Empty;

    public string OwnerUserId { get; init; } = string.Empty;

    public DateTimeOffset CreatedAt { get; init; }

    public bool IsExisting { get; init; }
    public ConversationKind Kind { get; init; }
    public Guid? ContextPostId { get; init; }
    public Guid? ContextOfferId { get; init; }
}
