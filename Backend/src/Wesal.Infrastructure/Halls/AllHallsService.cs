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

        var halls = await _hallRepository.GetApprovedHallsPaginatedAsync(skip, pageSize, cancellationToken);
        var totalCount = await _hallRepository.GetApprovedHallsCountAsync(cancellationToken);

        // Edits 18/29: halls whose stored cover is blank still show their first gallery
        // photo instead of a null image. One batched lookup for the whole page.
        var galleryCovers = await _hallRepository.GetFirstGalleryImageUrlsAsync(
            halls.Select(hall => hall.Id).ToList(), cancellationToken);

        var items = halls
            .Select(hall => new HallListItemDto
            {
                HallId = hall.Id,
                HallName = hall.Name,
                MainImage = HallMediaUrl.ResolveCoverUrl(
                    hall.MainImageUrl,
                    galleryCovers.TryGetValue(hall.Id, out var galleryUrl) ? [galleryUrl] : null),
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
