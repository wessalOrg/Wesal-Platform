using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface ICommentService
{
    Task<CommentResponse> CreateCommentAsync(CreateCommentRequest request, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CommentResponse>> GetHallCommentsAsync(Guid hallId, CancellationToken cancellationToken = default);
}
