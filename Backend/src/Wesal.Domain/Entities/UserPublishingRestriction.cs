using Wesal.Domain.Common;

namespace Wesal.Domain.Entities;

public sealed class UserPublishingRestriction : BaseEntity
{
    public string UserId { get; set; } = string.Empty;
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset EndsAt { get; set; }
    public string? Reason { get; set; }
    public string CreatedByAdminId { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? LiftedAt { get; set; }
    public string? LiftedByAdminId { get; set; }
}
