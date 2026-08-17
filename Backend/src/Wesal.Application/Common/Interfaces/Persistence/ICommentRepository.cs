using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface ICommentRepository
{
    Task AddAsync(Comment comment, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Comment>> GetByHallIdAsync(Guid hallId, CancellationToken cancellationToken = default);
}
