using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IFeaturedHallsService
{
    Task<IReadOnlyList<FeaturedHallDto>> GetFeaturedHallsAsync(CancellationToken cancellationToken = default);
}
