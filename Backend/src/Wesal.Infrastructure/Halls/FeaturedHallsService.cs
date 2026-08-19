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

    public async Task<IReadOnlyList<FeaturedHallDto>> GetFeaturedHallsAsync(
        HallRegion? region = null,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var halls = region is null
            ? await _hallRepository.GetApprovedHallsAsync(FeatureCount, cancellationToken)
            : await _hallRepository.GetApprovedHallsByRegionAsync(region.Value, FeatureCount, cancellationToken);

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
