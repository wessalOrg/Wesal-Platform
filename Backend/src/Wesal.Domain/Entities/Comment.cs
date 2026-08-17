using Wesal.Domain.Common;

namespace Wesal.Domain.Entities;

public class Comment : BaseAuditableEntity
{
    public Guid HallId { get; set; }

    public Hall Hall { get; set; } = null!;

    public string UserId { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;
}
