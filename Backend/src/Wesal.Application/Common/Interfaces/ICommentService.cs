using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface ICommentService
{
    Task<CommentResponse> CreateCommentAsync(CreateCommentRequest request, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CommentResponse>> GetHallCommentsAsync(Guid hallId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Author-owned comment edit (Edit 22). Throws NotFoundException for a missing or
    /// deleted comment and ForbiddenException when the caller is not the author.
    /// </summary>
    Task<CommentResponse> UpdateCommentAsync(
        Guid commentId,
        UpdateCommentRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Author-owned comment soft-delete (Edit 22). Same not-found/authorship contract
    /// as <see cref="UpdateCommentAsync"/>.
    /// </summary>
    Task DeleteCommentAsync(Guid commentId, CancellationToken cancellationToken = default);
}
