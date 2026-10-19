using Wesal.Domain.Common;

namespace Wesal.Domain.Entities;

public sealed class PostImage : BaseEntity
{
    public Guid PostId { get; set; }
    public Post Post { get; set; } = null!;
    public int Order { get; set; }
    public string StorageKey { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
}
