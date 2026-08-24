using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.Halls;

namespace Wesal.Infrastructure.AiAssistant;

public sealed class HallRecommendationMatcher : IHallRecommendationMatcher
{
    private readonly IHallRepository _hallRepository;

    public HallRecommendationMatcher(IHallRepository hallRepository)
    {
        _hallRepository = hallRepository;
    }

    public async Task<IReadOnlyList<HallRecommendationDto>> FindMatchingHallsAsync(
        ExtractedCriteriaDto criteria,
        CancellationToken cancellationToken = default)
    {
        // Validate extracted criteria safely
        HallRegion? region = null;
        if (!string.IsNullOrWhiteSpace(criteria.Region) && Enum.TryParse<HallRegion>(criteria.Region, true, out var parsedRegion))
            region = parsedRegion;

        BookingPeriodType? period = null;
        if (!string.IsNullOrWhiteSpace(criteria.BookingPeriod) && Enum.TryParse<BookingPeriodType>(criteria.BookingPeriod, true, out var parsedPeriod))
            period = parsedPeriod;

        DateOnly? date = criteria.Date;

        // Use existing repository search with database-level filtering (reuses business rules: Approved, not Deleted, booked check)
        var candidates = await _hallRepository.SearchApprovedHallsAsync(
            name: null,
            region: region,
            area: criteria.Area,
            date: date,
            period: period,
            skip: 0,
            take: 50,
            cancellationToken);

        if (candidates.Count == 0)
            return Array.Empty<HallRecommendationDto>();

        // Capacity filtering in-memory where supported (Hall.Capacity)
        if (criteria.Capacity.HasValue)
        {
            var required = criteria.Capacity.Value;
            candidates = candidates.Where(h => h.Capacity >= required).ToList();
            if (candidates.Count == 0)
                return Array.Empty<HallRecommendationDto>();
        }

        // Real availability verification for every candidate when date+period provided
        if (date.HasValue && period.HasValue)
        {
            var hallIds = candidates.Select(h => h.Id).ToList();
            var availability = await _hallRepository.GetAvailabilityAsync(hallIds, date.Value, date.Value, cancellationToken);
            var bookedSet = new HashSet<Guid>(availability
                .Where(a => a.Status == AvailabilityStatus.Booked && a.PeriodType == period.Value && a.Date == date.Value)
                .Select(a => a.HallId));

            candidates = candidates.Where(h => !bookedSet.Contains(h.Id)).ToList();
            if (candidates.Count == 0)
                return Array.Empty<HallRecommendationDto>();

            // Re-check immediately before finalization to reduce race
            var recheckIds = candidates.Select(h => h.Id).ToList();
            var recheckAvailability = await _hallRepository.GetAvailabilityAsync(recheckIds, date.Value, date.Value, cancellationToken);
            var recheckBooked = new HashSet<Guid>(recheckAvailability
                .Where(a => a.Status == AvailabilityStatus.Booked && a.PeriodType == period.Value && a.Date == date.Value)
                .Select(a => a.HallId));

            candidates = candidates.Where(h => !recheckBooked.Contains(h.Id)).ToList();
        }

        // Map to recommendation DTOs (reuse display name logic)
        var result = candidates.Select(h => new HallRecommendationDto(
            HallId: h.Id,
            HallName: h.Name,
            Region: HallDisplayNames.GetRegionDisplayName(h.Region),
            Address: h.Address,
            Capacity: h.Capacity,
            Price: h.ShowPrice ? h.Price : null,
            MainImage: h.MainImageUrl,
            IsAvailable: true,
            UnavailableReason: null
        )).ToList();

        return result;
    }
}
