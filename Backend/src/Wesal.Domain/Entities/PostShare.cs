using Wesal.Domain.Common;

namespace Wesal.Domain.Entities;

public sealed class PostShare : BaseEntity
{
    public Guid PostId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public DateOnly UtcDate { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
