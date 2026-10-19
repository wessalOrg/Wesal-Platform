using Wesal.Domain.Notifications;

namespace Wesal.Application.Common.Models;

public sealed class UserNotificationDto
{
    public Guid Id { get; init; }
    public NotificationKind Kind { get; init; }
    public string Type => Kind.ToString();
    public string Title { get; init; } = string.Empty;
    public string Body { get; init; } = string.Empty;
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset? ReadAt { get; init; }
    public bool IsRead => ReadAt.HasValue;
    public NotificationActionTarget ActionTarget { get; init; }
    public string? TargetId { get; init; }
    public Guid? ConversationId { get; init; }
    public string? SenderName { get; init; }
    public string? SenderAvatarUrl { get; init; }
    public string? MessagePreview { get; init; }
    public int MessageCount { get; init; }
}

public sealed class MarkNotificationsReadResponse
{
    public int UpdatedCount { get; init; }
}

public sealed class CreatePublishingRestrictionRequest
{
    public int DurationHours { get; init; }
    public string? Reason { get; init; }
}

public sealed class PublishingRestrictionStatusResponse
{
    public bool IsRestricted { get; init; }
    public DateTimeOffset? RestrictedUntil { get; init; }
}

public sealed class DeleteContentRequest
{
    public string Reason { get; init; } = string.Empty;
}

public sealed class DeleteAccountRequest
{
    public bool Confirm { get; init; }
}

public sealed class AdminActionResult
{
    public bool Success { get; init; }
    public int RemovedCount { get; init; }
    public IReadOnlyDictionary<string, int> RemovedItems { get; init; } = new Dictionary<string, int>();
}
