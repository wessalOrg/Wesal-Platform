using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IHallSearchService
{
    Task<PagedResult<HallListItemDto>> SearchHallsAsync(
        HallSearchRequest request,
        CancellationToken cancellationToken = default);
}
