using Wesal.Domain.Common;

namespace Wesal.Domain.Entities;

/// <summary>A user comment on a public professional post. Replies are flattened to the top-level parent.</summary>
public sealed class PostComment : BaseAuditableEntity
{
    public Guid PostId { get; set; }
    public string AuthorUserId { get; set; } = string.Empty;
    public Guid? ParentCommentId { get; set; }
    public Guid? ReplyToCommentId { get; set; }
    public string Text { get; set; } = string.Empty;
    public PostComment? ParentComment { get; set; }
}
