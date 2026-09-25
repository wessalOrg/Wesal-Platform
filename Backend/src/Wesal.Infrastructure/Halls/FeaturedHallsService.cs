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
    private readonly IHourlySlotService _hourlySlotService;
    private readonly ILogger<FeaturedHallsService> _logger;

    public FeaturedHallsService(
        IHallRepository hallRepository,
        IDateTime dateTime,
        IHourlySlotService hourlySlotService,
        ILogger<FeaturedHallsService> logger)
    {
        _hallRepository = hallRepository;
        _dateTime = dateTime;
        _hourlySlotService = hourlySlotService;
        _logger = logger;
    }

    public Task<IReadOnlyList<FeaturedHallDto>> GetFeaturedHallsAsync(
        HallRegion? region = null,
        CancellationToken cancellationToken = default)
        => GetMappedHallsAsync(region, FeatureCount, cancellationToken);

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

        var fromDate = DateOnly.FromDateTime(_dateTime.Now.UtcDateTime);
        var toDate = fromDate.AddDays(AvailabilityDays - 1);

        var featuredHalls = new List<FeaturedHallDto>(halls.Count);
        foreach (var hall in halls)
        {
            featuredHalls.Add(await BuildFeaturedHallAsync(hall, fromDate, toDate, cancellationToken));
        }

        return featuredHalls;
    }

    private async Task<FeaturedHallDto> BuildFeaturedHallAsync(
        Hall hall,
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken)
    {
        var days = new List<HallAvailabilityDto>((toDate.DayNumber - fromDate.DayNumber) + 1);

        for (var date = fromDate; date <= toDate; date = date.AddDays(1))
        {
            var catalog = await _hourlySlotService.GetHourlyCatalogAsync(hall.Id, date, cancellationToken);

            // DayOpen is carried through from the same catalog call the hall-details
            // endpoint uses (WESAL-TASK-5, Edit 5), so both embedded-availability
            // surfaces report a blocked day identically instead of one of them
            // defaulting the flag to false and claiming every day is closed.
            days.Add(new HallAvailabilityDto
            {
                Date = date,
                DayOpen = catalog.DayOpen,
                Slots = catalog.Slots
            });
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
