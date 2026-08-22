using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Interfaces;

public interface IFeaturedHallsService
{
    Task<IReadOnlyList<FeaturedHallDto>> GetFeaturedHallsAsync(
        HallRegion? region = null,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<FeaturedHallDto>> GetApprovedHallsAsync(
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<FeaturedHallDto>> SearchHallsAsync(
        HallSearchQuery query,
        CancellationToken cancellationToken = default);
}
