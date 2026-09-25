using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Halls;

public class HallDetailsService : IHallDetailsService
{
    private readonly IHallRepository _hallRepository;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTime _dateTime;
    private readonly IHourlySlotService _hourlySlotService;
    private readonly ILogger<HallDetailsService> _logger;

    public HallDetailsService(
        IHallRepository hallRepository,
        ICurrentUserService currentUser,
        IDateTime dateTime,
        IHourlySlotService hourlySlotService,
        ILogger<HallDetailsService> logger)
    {
        _hallRepository = hallRepository;
        _currentUser = currentUser;
        _dateTime = dateTime;
        _hourlySlotService = hourlySlotService;
        _logger = logger;
    }

    public async Task<HallDetailsDto> GetHallDetailsAsync(Guid hallId, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var hall = await _hallRepository.GetHallByIdAsync(hallId, cancellationToken);

        // HallPublicVisibility is the single source of truth for this rule, shared with the
        // public hourly availability endpoints so a hidden hall can never leak its schedule
        // through one surface while 404ing on another.
        if (hall is null || !HallPublicVisibility.IsPubliclyVisible(hall))
        {
            _logger.LogInformation(
                "Hall {HallId} is not available for public details (status {Status}, payment {Payment}, deleted {IsDeleted}, adminLocked {IsAdminLocked}, systemLocked {SystemLocked}).",
                hallId,
                hall?.Status.ToString() ?? "Unknown",
                hall?.PaymentStatus.ToString() ?? "Unknown",
                hall?.IsDeleted ?? true,
                hall?.IsAdminLocked ?? false,
                hall?.SystemLocked ?? false);

            throw new NotFoundException(nameof(Hall), hallId);
        }

        var images = await _hallRepository.GetHallImagesAsync(hallId, cancellationToken);
        var features = await _hallRepository.GetHallFeaturesAsync([hallId], cancellationToken);
        var fromDate = DateOnly.FromDateTime(_dateTime.Now.UtcDateTime);
        var toDate = fromDate.AddDays(FeaturedHallsService.AvailabilityDays - 1);
        var availability = await BuildAvailabilityAsync(hallId, fromDate, toDate, cancellationToken);

        return new HallDetailsDto
        {
            HallId = hall.Id,
            HallName = hall.Name,
            Region = HallDisplayNames.GetRegionDisplayName(hall.Region),
            Address = hall.Address,
            DetailedAddress = hall.DetailedAddress,
            Description = hall.Description,
            Capacity = hall.Capacity,
            Price = hall.ShowPrice ? hall.Price : null,
            ShowPrice = hall.ShowPrice,
            ContactPhone = hall.ContactPhone,
            MainImageUrl = hall.MainImageUrl,
            YouTubeVideoUrl = hall.YouTubeVideoUrl,
            HourlySlotStart = hall.HourlySlotStart,
            HourlySlotEnd = hall.HourlySlotEnd,
            Features = features
                .Where(feature => !string.IsNullOrWhiteSpace(feature.Name))
                .Select(feature => feature.Name)
                .ToList(),
            OtherFeatures = hall.OtherFeatures,
            Status = hall.Status,
            IsOwner = IsHallOwner(hall),
            Photos = images
                .Where(image => !string.IsNullOrWhiteSpace(image.Url))
                .Select(image => new HallImageDto
                {
                    Id = image.Id,
                    Url = image.Url,
                    DisplayOrder = image.DisplayOrder
                })
                .ToList(),
            Availability = availability
        };
    }

    private bool IsHallOwner(Hall hall)
        => _currentUser.IsAuthenticated
           && !string.IsNullOrWhiteSpace(hall.OwnerId)
           && string.Equals(_currentUser.UserId, hall.OwnerId, StringComparison.Ordinal);

    private async Task<IReadOnlyList<HallAvailabilityDto>> BuildAvailabilityAsync(
        Guid hallId,
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken)
    {
        var days = new List<HallAvailabilityDto>((toDate.DayNumber - fromDate.DayNumber) + 1);

        for (var date = fromDate; date <= toDate; date = date.AddDays(1))
        {
            // The dedicated hourly-catalog endpoint is the single source of truth for
            // this rule (WESAL-TASK-1), including the ShowBookedSlots owner toggle and the
            // blocked-day disclosure. Delegating here is what keeps the embedded
            // availability in step with that endpoint, instead of a second implementation
            // of the same rules that could drift away from it.
            var catalog = await _hourlySlotService.GetHourlyCatalogAsync(hallId, date, cancellationToken);
            days.Add(new HallAvailabilityDto
            {
                Date = date,
                DayOpen = catalog.DayOpen,
                Slots = catalog.Slots
            });
        }

        return days;
    }
}
