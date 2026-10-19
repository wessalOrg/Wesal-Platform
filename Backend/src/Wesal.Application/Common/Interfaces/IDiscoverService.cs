using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IDiscoverService
{
    Task<PagedResult<DiscoverItemDto>> GetFeedAsync(string filter, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<PagedResult<DiscoverItemDto>> SearchAsync(string filter, string query, int page, int pageSize, CancellationToken cancellationToken = default);
}

public interface IStatisticsService
{
    Task RecordPostViewAsync(Guid postId, CancellationToken cancellationToken = default);
    Task RecordProfileViewAsync(string profileUserId, CancellationToken cancellationToken = default);
    Task<OwnerStatisticsDto> GetMyStatisticsAsync(int page, int pageSize, CancellationToken cancellationToken = default);
}
