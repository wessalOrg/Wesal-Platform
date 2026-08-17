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

    public string UserName { get; init; } = string.Empty;

    public DateTimeOffset CreatedAt { get; init; }
}
