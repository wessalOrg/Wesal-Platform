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

public sealed class CreateAccountLockRequest
{
    public int DurationHours { get; init; }
    public string? Reason { get; init; }
}

public sealed class AccountLockStatusResponse
{
    public bool IsLocked { get; init; }
    public DateTimeOffset? LockedUntil { get; init; }
    public string? Reason { get; init; }
}

public sealed class AdminLockedAccountDto
{
    public string UserId { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;
    public string? BusinessName { get; init; }
    public string Role { get; init; } = string.Empty;
    public DateTimeOffset LockedAt { get; init; }
    public DateTimeOffset LockedUntil { get; init; }
    public TimeSpan Remaining { get; init; }
    public string? Reason { get; init; }
    public string LockingAdminId { get; init; } = string.Empty;
    public string? PhotographerAdminOnlyFullName { get; init; }
    public string UnlockAction { get; init; } = string.Empty;
}

public sealed class AdminModeratedContentDto
{
    public Guid Id { get; init; }
    public string OwnerUserId { get; init; } = string.Empty;
    public string OwnerDisplayName { get; init; } = string.Empty;
    public string OwnerRole { get; init; } = string.Empty;
    public bool OwnerIsLocked { get; init; }
    public string? Content { get; init; }
    public decimal? Price { get; init; }
    public decimal? OldPrice { get; init; }
    public decimal? OfferPrice { get; init; }
    public DateTimeOffset? StartsAt { get; init; }
    public DateTimeOffset? EndsAt { get; init; }
    public DateTimeOffset? StoppedAt { get; init; }
    public string? Status { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public IReadOnlyList<PublicProfileImageDto> Images { get; init; } = [];
}

public sealed class DeleteContentRequest
{
    public string Reason { get; init; } = string.Empty;
}

public sealed class AdminActionResult
{
    public bool Success { get; init; }
    public int RemovedCount { get; init; }
    public IReadOnlyDictionary<string, int> RemovedItems { get; init; } = new Dictionary<string, int>();
}
