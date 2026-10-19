using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IPostService
{
    Task<Guid> CreateAsync(CreatePostRequest request, CancellationToken cancellationToken = default);
    Task UpdateAsync(Guid postId, UpdatePostRequest request, CancellationToken cancellationToken = default);
    Task<PagedResult<PublicProfileContentDto>> ListProfileAsync(string userId, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<PublicProfileContentDto> GetPublicAsync(Guid postId, CancellationToken cancellationToken = default);
    Task<StoredDocument> GetImageAsync(Guid postId, Guid imageId, CancellationToken cancellationToken = default);
}
