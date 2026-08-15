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

    public HallDetailsService(
        IHallRepository hallRepository,
        ICurrentUserService currentUser,
        IDateTime dateTime,
        ILogger<HallDetailsService> logger)
    {
        _hallRepository = hallRepository;
        _currentUser = currentUser;
        _dateTime = dateTime;
        _logger = logger;
    }

    public async Task<HallDetailsDto> GetHallDetailsAsync(Guid hallId, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var hall = await _hallRepository.GetHallByIdAsync(hallId, cancellationToken);

        if (hall is null || hall.IsDeleted || hall.Status != HallStatus.Approved)
        {
            _logger.LogInformation(
                "Hall {HallId} is not available for public details (status {Status}, deleted {IsDeleted}).",
                hallId,
                hall?.Status.ToString() ?? "Unknown",
                hall?.IsDeleted ?? true);

            throw new NotFoundException(nameof(Hall), hallId);
        }

        var imagesTask = _hallRepository.GetHallImagesAsync(hallId, cancellationToken);
        var fromDate = DateOnly.FromDateTime(_dateTime.Now.UtcDateTime);
        var toDate = fromDate.AddDays(FeaturedHallsService.AvailabilityDays - 1);

        var periodsTask = _hallRepository.GetBookingPeriodsAsync([hallId], cancellationToken);
        var availabilityTask = _hallRepository.GetAvailabilityAsync([hallId], fromDate, toDate, cancellationToken);

        await Task.WhenAll(imagesTask, periodsTask, availabilityTask);

        var photos = imagesTask.Result
            .Where(image => !string.IsNullOrWhiteSpace(image.Url))
            .Select(image => new HallImageDto { Id = image.Id, Url = image.Url })
            .ToList();

        var periods = periodsTask.Result;
        var availabilityByKey = availabilityTask.Result.ToDictionary(item => (item.HallId, item.Date, item.PeriodType));

        return new HallDetailsDto
        {
            HallId = hall.Id,
            HallName = hall.Name,
            Region = HallDisplayNames.GetRegionDisplayName(hall.Region),
            Address = hall.Address,
            Description = hall.Description,
            Capacity = hall.Capacity,
            Price = hall.ShowPrice ? hall.Price : null,
            ContactPhone = hall.ContactPhone,
            Status = hall.Status,
            IsOwner = IsHallOwner(hall),
            Photos = photos,
            Availability = BuildAvailability(hallId, periods, availabilityByKey, fromDate, toDate)
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
