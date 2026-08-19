using Wesal.Domain.Common;

namespace Wesal.Domain.Entities;

public class Conversation : BaseAuditableEntity
{
    public Guid HallId { get; set; }

    public Hall Hall { get; set; } = null!;

    public string InitiatorUserId { get; set; } = string.Empty;

    public string OwnerUserId { get; set; } = string.Empty;
}
