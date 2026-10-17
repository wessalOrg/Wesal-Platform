using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;

namespace Wesal.Infrastructure.AiAssistant;

public sealed class HallRecommendationMatcher : IHallRecommendationMatcher
{
    private readonly IHallSearchService _hallSearchService;

    public HallRecommendationMatcher(IHallSearchService hallSearchService)
    {
        _hallSearchService = hallSearchService;
    }

    public async Task<IReadOnlyList<HallRecommendationDto>> FindMatchingHallsAsync(
        ExtractedCriteriaDto criteria,
        CancellationToken cancellationToken = default)
    {
        HallRegion? region = null;
        if (!string.IsNullOrWhiteSpace(criteria.Region)
            && Enum.TryParse<HallRegion>(criteria.Region, true, out var parsedRegion))
        {
            region = parsedRegion;
        }

        var page = await _hallSearchService.SearchHallsAsync(
            new HallSearchRequest
            {
                Region = region,
                Area = criteria.Area,
                Date = criteria.Date,
                MinimumCapacity = criteria.Capacity,
                MaximumPrice = criteria.MaximumPrice,
                MinimumPrice = criteria.MinimumPrice,
                AroundPrice = criteria.AroundPrice,
                SortByPrice = criteria.SortByPrice,
                SortPreference = criteria.SortPreference,
                PageNumber = 1,
                PageSize = 50
            },
            cancellationToken);

        return page.Items
            .Select(hall => new HallRecommendationDto(
                hall.HallId,
                hall.HallName,
                hall.Region,
                hall.Address,
                hall.Capacity,
                hall.Price,
                hall.MainImage,
                IsAvailable: true,
                UnavailableReason: null))
            .ToList();
    }
}
