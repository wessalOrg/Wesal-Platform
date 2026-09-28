using Wesal.Domain.Common;

namespace Wesal.Domain.Entities;

public class Comment : BaseAuditableEntity
{
    public Guid HallId { get; set; }

    public Hall Hall { get; set; } = null!;

    public string UserId { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// Author-owned soft delete (Edit 22): a deleted comment stays in history but is
    /// excluded from every normal retrieval, matching the <see cref="HallImage"/>
    /// convention rather than hard-removing the row.
    /// </summary>
    public bool IsDeleted { get; set; }
}
