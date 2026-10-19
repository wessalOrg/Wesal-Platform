namespace Wesal.Domain.Entities;

/// <summary>A user's saved post. (UserId, PostId) is unique.</summary>
public sealed class PostFavorite
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public Guid PostId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
