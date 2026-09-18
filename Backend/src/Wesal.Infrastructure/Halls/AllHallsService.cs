using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.Halls;

public class AllHallsService : IAllHallsService
{
    private readonly IHallRepository _hallRepository;
    private readonly IHallAvailabilityCleanupService? _cleanupService;

    public AllHallsService(IHallRepository hallRepository, IHallAvailabilityCleanupService? cleanupService = null)
    {
        _hallRepository = hallRepository;
        _cleanupService = cleanupService;
    }

    public async Task<PagedResult<HallListItemDto>> GetApprovedHallsAsync(
        int pageNumber,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        if (_cleanupService != null) try { await _cleanupService.CleanupExpiredAsync(cancellationToken); } catch { }
        pageNumber = Math.Max(1, pageNumber);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var skip = (pageNumber - 1) * pageSize;

        var halls = await _hallRepository.GetApprovedHallsPaginatedAsync(skip, pageSize, cancellationToken);
        var totalCount = await _hallRepository.GetApprovedHallsCountAsync(cancellationToken);

        var items = halls
            .Select(hall => new HallListItemDto
            {
                HallId = hall.Id,
                HallName = hall.Name,
                MainImage = hall.MainImageUrl,
                Region = HallDisplayNames.GetRegionDisplayName(hall.Region),
                Address = hall.Address,
                Capacity = hall.Capacity,
                Price = hall.ShowPrice ? hall.Price : null,
                Description = hall.Description
            })
            .ToList();

        return PagedResult<HallListItemDto>.Create(items, pageNumber, pageSize, totalCount);
    }
}
