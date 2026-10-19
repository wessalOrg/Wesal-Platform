using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IPostInteractionService
{
    Task<PostCommentDto> CreateCommentAsync(Guid postId, CreatePostCommentRequest request, CancellationToken cancellationToken = default);
    Task<PostCommentDto> ReplyAsync(Guid postId, Guid commentId, CreatePostCommentRequest request, CancellationToken cancellationToken = default);
    Task<PagedResult<PostCommentDto>> ListCommentsAsync(Guid postId, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<PagedResult<PostCommentDto>> ListRepliesAsync(Guid postId, Guid commentId, int page, int pageSize, CancellationToken cancellationToken = default);
    Task DeleteCommentAsync(Guid postId, Guid commentId, CancellationToken cancellationToken = default);
    Task AddFavoriteAsync(Guid postId, CancellationToken cancellationToken = default);
    Task RemoveFavoriteAsync(Guid postId, CancellationToken cancellationToken = default);
    Task<PagedResult<FavoritePostDto>> ListFavoritesAsync(int page, int pageSize, CancellationToken cancellationToken = default);
}
