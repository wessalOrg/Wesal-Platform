using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IPostInteractionRepository
{
    Task<Post?> GetPublicPostAsync(Guid postId, CancellationToken cancellationToken = default);
    Task<PostComment?> GetCommentAsync(Guid commentId, bool tracking, CancellationToken cancellationToken = default);
    void AddComment(PostComment comment);
    void RemoveComment(PostComment comment);
    void RemoveComments(IEnumerable<PostComment> comments);
    Task<IReadOnlyList<PostComment>> ListTopLevelCommentsAsync(Guid postId, int skip, int take, CancellationToken cancellationToken = default);
    Task<int> CountTopLevelCommentsAsync(Guid postId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PostComment>> ListRepliesAsync(Guid rootCommentId, int skip, int take, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PostComment>> ListRepliesForDeleteAsync(Guid rootCommentId, CancellationToken cancellationToken = default);
    Task<int> CountRepliesAsync(Guid rootCommentId, CancellationToken cancellationToken = default);
    Task<PostAuthorPublicData?> GetAuthorPublicDataAsync(string userId, CancellationToken cancellationToken = default);
    Task<int> AddFavoriteAndIncrementAsync(string userId, Guid postId, DateTimeOffset now, CancellationToken cancellationToken = default);
    Task<int> RemoveFavoriteAndDecrementAsync(string userId, Guid postId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PostFavoriteWithPost>> ListVisibleFavoritesAsync(string userId, int skip, int take, CancellationToken cancellationToken = default);
    Task<int> CountVisibleFavoritesAsync(string userId, CancellationToken cancellationToken = default);
}
