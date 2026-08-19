using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;

namespace Wesal.Infrastructure.Halls;

public class FeaturedHallsService : IFeaturedHallsService
{
    public const int FeatureCount = 6;

    public const int AvailabilityDays = 7;

    private readonly IHallRepository _hallRepository;
    private readonly IDateTime _dateTime;
    private readonly ILogger<FeaturedHallsService> _logger;

    public FeaturedHallsService(
        IHallRepository hallRepository,
        IDateTime dateTime,
        ILogger<FeaturedHallsService> logger)
    {
        _hallRepository = hallRepository;
        _dateTime = dateTime;
        _logger = logger;
    }

    public Task<IReadOnlyList<FeaturedHallDto>> GetFeaturedHallsAsync(
        HallRegion? region = null,
        CancellationToken cancellationToken = default)
        => GetMappedHallsAsync(region, FeatureCount, cancellationToken);

    public Task<IReadOnlyList<FeaturedHallDto>> GetApprovedHallsAsync(
        CancellationToken cancellationToken = default)
        => GetMappedHallsAsync(region: null, take: null, cancellationToken);

    public async Task<IReadOnlyList<FeaturedHallDto>> SearchHallsAsync(
        HallSearchQuery query,
        CancellationToken cancellationToken = default)
    {
        var halls = await GetMappedHallsAsync(query.Region, take: null, cancellationToken);

        return halls.Where(hall => MatchesSearch(hall, query)).ToList();
    }

    private async Task<IReadOnlyList<FeaturedHallDto>> GetMappedHallsAsync(
        HallRegion? region,
        int? take,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var limit = take ?? int.MaxValue;
        var halls = region is null
            ? await _hallRepository.GetApprovedHallsAsync(limit, cancellationToken)
            : await _hallRepository.GetApprovedHallsByRegionAsync(region.Value, limit, cancellationToken);

        if (halls.Count == 0)
        {
            _logger.LogInformation(
                "No approved halls found in region {Region}; returning an empty featured halls list.",
                region?.ToString() ?? "All");

            return [];
        }

        var hallIds = halls.Select(hall => hall.Id).ToHashSet();

        var periodsTask = _hallRepository.GetBookingPeriodsAsync(hallIds, cancellationToken);
        var fromDate = DateOnly.FromDateTime(_dateTime.Now.UtcDateTime);
        var toDate = fromDate.AddDays(AvailabilityDays - 1);

        var availabilityTask = _hallRepository.GetAvailabilityAsync(hallIds, fromDate, toDate, cancellationToken);

        await Task.WhenAll(periodsTask, availabilityTask);

        var periods = periodsTask.Result;
        var availability = availabilityTask.Result;

        var availabilityByKey = availability.ToDictionary(item => (item.HallId, item.Date, item.PeriodType));
        var periodsByHall = periods.GroupBy(period => period.HallId)
            .ToDictionary(group => group.Key, group => group.ToList());

        return halls
            .Select(hall => BuildFeaturedHall(hall, periodsByHall, availabilityByKey, fromDate, toDate))
            .ToList();
    }

    private static bool MatchesSearch(FeaturedHallDto hall, HallSearchQuery query)
    {
        if (!string.IsNullOrWhiteSpace(query.Name)
            && !hall.HallName.Contains(query.Name.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(query.Address)
            && !hall.Address.Contains(query.Address.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (query.Date is null && query.Period is null)
        {
            return true;
        }

        var days = query.Date is { } date
            ? hall.Availability.Where(day => day.Date == date)
            : hall.Availability.AsEnumerable();

        return days.Any(day =>
            day.Periods.Any(period =>
                period.Status == AvailabilityStatus.Available
                && (query.Period is null || period.PeriodType == query.Period)));
    }

    private static FeaturedHallDto BuildFeaturedHall(
        Hall hall,
        IReadOnlyDictionary<Guid, List<HallBookingPeriod>> periodsByHall,
        IReadOnlyDictionary<(Guid HallId, DateOnly Date, BookingPeriodType PeriodType), HallAvailability> availabilityByKey,
        DateOnly fromDate,
        DateOnly toDate)
    {
        var hallPeriods = periodsByHall.GetValueOrDefault(hall.Id) ?? [];

        var days = new List<HallAvailabilityDto>((toDate.DayNumber - fromDate.DayNumber) + 1);

        for (var date = fromDate; date <= toDate; date = date.AddDays(1))
        {
            var dayPeriods = hallPeriods
                .Select(period => new HallBookingPeriodStatusDto
                {
                    PeriodType = period.Type,
                    PeriodName = HallDisplayNames.GetPeriodName(period.Type),
                    StartTime = period.StartTime,
                    EndTime = period.EndTime,
                    Status = availabilityByKey.TryGetValue((hall.Id, date, period.Type), out var availability)
                        ? availability.Status
                        : AvailabilityStatus.Available
                })
                .ToList();

            days.Add(new HallAvailabilityDto { Date = date, Periods = dayPeriods });
        }

        return new FeaturedHallDto
        {
            HallId = hall.Id,
            HallName = hall.Name,
            MainImage = hall.MainImageUrl,
            Region = HallDisplayNames.GetRegionDisplayName(hall.Region),
            Address = hall.Address,
            Capacity = hall.Capacity,
            Price = hall.ShowPrice ? hall.Price : null,
            ShortDescription = hall.Description,
            Availability = days
        };
    }
}
