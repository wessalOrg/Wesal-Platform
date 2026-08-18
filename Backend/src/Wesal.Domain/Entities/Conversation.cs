using Wesal.Domain.Common;

namespace Wesal.Domain.Entities;

public class Conversation : BaseAuditableEntity
{
    public Guid HallId { get; set; }

    public Hall Hall { get; set; } = null!;

    public string SenderUserId { get; set; } = string.Empty;

    public string HallOwnerId { get; set; } = string.Empty;
}
