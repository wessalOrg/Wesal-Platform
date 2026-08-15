using Wesal.Domain.Common;

namespace Wesal.Domain.Entities;

public class HallImage : BaseAuditableEntity
{
    public Guid HallId { get; set; }

    public Hall Hall { get; set; } = null!;

    public string Url { get; set; } = string.Empty;

    public int DisplayOrder { get; set; }

    public bool IsDeleted { get; set; }
}
