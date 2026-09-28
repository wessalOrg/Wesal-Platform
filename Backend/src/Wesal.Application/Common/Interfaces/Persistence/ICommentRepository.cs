using Wesal.Domain.Entities;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface ICommentRepository
{
    Task AddAsync(Comment comment, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Comment>> GetByHallIdAsync(Guid hallId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Finds one non-deleted comment by id for author-owned edit/delete (Edit 22).
    /// Returns <c>null</c> when the comment does not exist or was deleted. Default
    /// implementation returns <c>null</c> so existing test doubles keep compiling.
    /// </summary>
    Task<Comment?> GetByIdAsync(Guid commentId, CancellationToken cancellationToken = default)
        => Task.FromResult<Comment?>(null);

    /// <summary>
    /// All non-deleted comments of a hall with their authors' profile display data in
    /// a single query (Edit 22): no per-comment user lookup. Default implementation
    /// returns an empty list so existing test doubles keep compiling.
    /// </summary>
    Task<IReadOnlyList<CommentAuthorRow>> GetByHallIdWithAuthorsAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<CommentAuthorRow>>([]);

    /// <summary>
    /// One user's profile display data for comment attribution (Edit 22). Returns
    /// <c>null</c> when the user no longer exists. Default implementation returns
    /// <c>null</c> so existing test doubles keep compiling.
    /// </summary>
    Task<CommentAuthorDisplay?> GetAuthorDisplayAsync(
        string userId,
        CancellationToken cancellationToken = default)
        => Task.FromResult<CommentAuthorDisplay?>(null);

    /// <summary>
    /// Persists tracked comment mutations (content edits, soft deletes). Default
    /// implementation is a no-op so existing test doubles keep compiling.
    /// </summary>
    Task SaveChangesAsync(CancellationToken cancellationToken = default)
        => Task.CompletedTask;
}
