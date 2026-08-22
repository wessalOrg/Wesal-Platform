using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.Halls;

public class AllHallsService : IAllHallsService
{
    private readonly IHallRepository _hallRepository;

    public AllHallsService(IHallRepository hallRepository)
    {
        _hallRepository = hallRepository;
    }

    public async Task<PagedResult<HallListItemDto>> GetApprovedHallsAsync(
        int pageNumber,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        pageNumber = Math.Max(1, pageNumber);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var skip = (pageNumber - 1) * pageSize;

        var hallsTask = _hallRepository.GetApprovedHallsPaginatedAsync(skip, pageSize, cancellationToken);
        var countTask = _hallRepository.GetApprovedHallsCountAsync(cancellationToken);

        await Task.WhenAll(hallsTask, countTask);

        var halls = hallsTask.Result;
        var totalCount = countTask.Result;

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
