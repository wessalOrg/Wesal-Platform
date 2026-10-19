using Wesal.Domain.Common;

namespace Wesal.Domain.Entities;

public sealed class Post : BaseAuditableEntity
{
    public string OwnerUserId { get; set; } = string.Empty;
    public string? Content { get; set; }
    public decimal? Price { get; set; }
    public int SaveCount { get; set; }
    public int ShareCount { get; set; }
    public ICollection<PostImage> Images { get; set; } = [];
}
