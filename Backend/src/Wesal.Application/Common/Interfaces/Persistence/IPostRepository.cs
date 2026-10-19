using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IPostRepository
{
    Task AddAsync(Post post, CancellationToken cancellationToken = default);
    void AddImage(PostImage image);
    Task<Post?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Post?> GetPublicAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Post>> ListPublicByOwnerAsync(string ownerId, int skip, int take, CancellationToken cancellationToken = default);
    Task<int> CountPublicByOwnerAsync(string ownerId, CancellationToken cancellationToken = default);
}
