namespace Wesal.Application.Common.Models;

public sealed class CreateCommentRequest
{
    public Guid HallId { get; init; }

    public string Content { get; init; } = string.Empty;
}

public sealed class CommentResponse
{
    public Guid CommentId { get; init; }

    public Guid HallId { get; init; }

    public string Content { get; init; } = string.Empty;

    /// <summary>
    /// The comment author's user id, so clients can afford edit/delete only to the
    /// author. Never taken from client input; resolved server-side.
    /// </summary>
    public string UserId { get; init; } = string.Empty;

    /// <summary>
    /// The author's persisted profile display name (Edit 22). Falls back to the
    /// sign-in name only when the profile itself is gone; never a generic placeholder
    /// while profile information exists.
    /// </summary>
    public string UserName { get; init; } = string.Empty;

    /// <summary>
    /// The author's profile picture URL when one is set (Edit 22); null otherwise.
    /// </summary>
    public string? UserProfilePictureUrl { get; init; }

    public DateTimeOffset CreatedAt { get; init; }
}

/// <summary>
/// Author-owned comment edit (Edit 22). Only the content is mutable; identity and
/// hall are resolved server-side and can never be changed by the client.
/// </summary>
public sealed class UpdateCommentRequest
{
    public string Content { get; init; } = string.Empty;
}

/// <summary>
/// One user's profile display data for comment attribution (Edit 22).
/// </summary>
public sealed class CommentAuthorDisplay
{
    public string UserId { get; init; } = string.Empty;

    public string FullName { get; init; } = string.Empty;

    public string? ProfilePictureUrl { get; init; }
}

/// <summary>
/// One comment with its author's profile display data, resolved in a single query
/// (Edit 22). The service maps rows to <see cref="CommentResponse"/>; repositories
/// never leak entities with lazily-loaded user data.
/// </summary>
public sealed class CommentAuthorRow
{
    public Guid CommentId { get; init; }

    public Guid HallId { get; init; }

    public string Content { get; init; } = string.Empty;

    public string AuthorUserId { get; init; } = string.Empty;

    public string? AuthorFullName { get; init; }

    public string? AuthorProfilePictureUrl { get; init; }

    public DateTimeOffset CreatedAt { get; init; }
}
