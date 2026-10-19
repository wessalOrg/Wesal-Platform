namespace Wesal.Application.Common.Models;

public sealed class CreatePostCommentRequest { public string Text { get; init; } = string.Empty; }

public sealed class PostCommentDto
{
    public Guid Id { get; init; }
    public Guid PostId { get; init; }
    public string Text { get; init; } = string.Empty;
    public string AuthorUserId { get; init; } = string.Empty;
    public string AuthorName { get; init; } = string.Empty;
    public string? AuthorAvatarUrl { get; init; }
    public Guid? ParentCommentId { get; init; }
    public Guid? ReplyToCommentId { get; init; }
    public int ReplyCount { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
}

public sealed class FavoritePostDto
{
    public Guid Id { get; init; }
    public string OwnerUserId { get; init; } = string.Empty;
    public string OwnerName { get; init; } = string.Empty;
    public string? OwnerAvatarUrl { get; init; }
    public string? Content { get; init; }
    public decimal? Price { get; init; }
    public int SaveCount { get; init; }
    public DateTimeOffset SavedAt { get; init; }
    public IReadOnlyList<PublicProfileImageDto> Images { get; init; } = [];
}
