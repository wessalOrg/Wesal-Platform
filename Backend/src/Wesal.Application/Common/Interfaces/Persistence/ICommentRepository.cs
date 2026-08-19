using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface ICommentRepository
{
    Task AddAsync(Comment comment, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CommentResponse>> ListByHallAsync(Guid hallId, CancellationToken cancellationToken = default);
}
