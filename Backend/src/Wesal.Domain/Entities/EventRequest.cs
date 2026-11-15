using Wesal.Domain.Common;
using Wesal.Domain.Enums;

namespace Wesal.Domain.Entities;

public sealed class EventRequest : BaseAuditableEntity
{
    public string SeekerId { get; set; } = string.Empty;
    public string SeekerFullName { get; set; } = string.Empty;
    public DateOnly EventDate { get; set; }
    public EventType EventType { get; set; }
    public bool NeedsHall { get; set; }
    public bool NeedsDecorationAndGifts { get; set; }
    public bool NeedsPhotographers { get; set; }
    public bool FanoutCompleted { get; set; }
    public int FanoutAttempts { get; set; }
    public DateTimeOffset? FanoutNextAttemptAt { get; set; }
}

public sealed class EventRequestNotificationTarget
{
    public Guid Id { get; set; }
    public Guid EventRequestId { get; set; }
    public string ProviderId { get; set; } = string.Empty;
    public ServiceType ServiceType { get; set; }
    public Guid NotificationId { get; set; }
    public Guid ConversationId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
