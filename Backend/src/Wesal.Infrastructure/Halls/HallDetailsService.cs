using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Halls;

public class HallDetailsService : IHallDetailsService
{
    private readonly IHallRepository _hallRepository;
    private readonly ICurrentUserService _currentUser;
    private readonly IDateTime _dateTime;
    private readonly ILogger<HallDetailsService> _logger;
    private readonly IHallAvailabilityCleanupService? _cleanupService;

    public HallDetailsService(
        IHallRepository hallRepository,
        ICurrentUserService currentUser,
        IDateTime dateTime,
        ILogger<HallDetailsService> logger,
        IHallAvailabilityCleanupService? cleanupService = null)
    {
        _hallRepository = hallRepository;
        _currentUser = currentUser;
        _dateTime = dateTime;
        _logger = logger;
        _cleanupService = cleanupService;
    }

    public async Task<HallDetailsDto> GetHallDetailsAsync(Guid hallId, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (_cleanupService != null) try { await _cleanupService.CleanupExpiredAsync(cancellationToken); } catch { }

        var hall = await _hallRepository.GetHallByIdAsync(hallId, cancellationToken);

        if (hall is null
            || hall.IsDeleted
            || hall.Status != HallStatus.Approved
            || hall.IsAdminLocked
            || hall.SystemLocked
            || hall.PaymentStatus != HallPaymentStatus.Paid)
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

        var periods = await _hallRepository.GetBookingPeriodsAsync([hallId], cancellationToken);
        var availability = await _hallRepository.GetAvailabilityAsync([hallId], fromDate, toDate, cancellationToken);

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
            ContactPhone = hall.ContactPhone,
            MainImageUrl = hall.MainImageUrl,
            YouTubeVideoUrl = hall.YouTubeVideoUrl,
            Features = features
                .Where(feature => !string.IsNullOrWhiteSpace(feature.Name))
                .Select(feature => feature.Name)
                .ToList(),
            OtherFeatures = hall.OtherFeatures,
            Status = hall.Status,
            IsOwner = IsHallOwner(hall),
            Photos = images
                .Where(image => !string.IsNullOrWhiteSpace(image.Url))
                .Select(image => new HallImageDto { Id = image.Id, Url = image.Url })
                .ToList(),
            Availability = BuildAvailability(hallId, periods, availability.ToDictionary(item => (item.HallId, item.Date, item.PeriodType)), fromDate, toDate)
        };
    }

    private bool IsHallOwner(Hall hall)
        => _currentUser.IsAuthenticated
           && !string.IsNullOrWhiteSpace(hall.OwnerId)
           && string.Equals(_currentUser.UserId, hall.OwnerId, StringComparison.Ordinal);

    private static IReadOnlyList<HallAvailabilityDto> BuildAvailability(
        Guid hallId,
        IReadOnlyList<HallBookingPeriod> periods,
        IReadOnlyDictionary<(Guid HallId, DateOnly Date, BookingPeriodType PeriodType), HallAvailability> availabilityByKey,
        DateOnly fromDate,
        DateOnly toDate)
    {
        var days = new List<HallAvailabilityDto>((toDate.DayNumber - fromDate.DayNumber) + 1);

        for (var date = fromDate; date <= toDate; date = date.AddDays(1))
        {
            var dayPeriods = periods
                .Select(period => new HallBookingPeriodStatusDto
                {
                    PeriodType = period.Type,
                    PeriodName = HallDisplayNames.GetPeriodName(period.Type),
                    StartTime = period.StartTime,
                    EndTime = period.EndTime,
                    Status = availabilityByKey.TryGetValue((hallId, date, period.Type), out var availability)
                        ? availability.Status
                        : AvailabilityStatus.Available
                })
                .ToList();

            days.Add(new HallAvailabilityDto { Date = date, Periods = dayPeriods });
        }

        return days;
    }
}
