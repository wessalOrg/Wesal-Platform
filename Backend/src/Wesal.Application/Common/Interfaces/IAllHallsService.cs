using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IAllHallsService
{
    Task<PagedResult<HallListItemDto>> GetApprovedHallsAsync(
        int pageNumber,
        int pageSize,
        CancellationToken cancellationToken = default);
}
