using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Halls;

/// <summary>
/// Application-facing public availability query shared by the REST/AI/MCP
/// surfaces. It intentionally relies on the hall repository only here, rather
/// than allowing a transport adapter to query persistence directly.
/// </summary>
public sealed class HallAvailabilityService : IHallAvailabilityService
{
    private readonly IHallRepository _hallRepository;
    private readonly ILogger<HallAvailabilityService> _logger;

    public HallAvailabilityService(
        IHallRepository hallRepository,
        ILogger<HallAvailabilityService> logger)
    {
        _hallRepository = hallRepository;
        _logger = logger;
    }

    public async Task<HallAvailabilityDto> GetHallAvailabilityAsync(
        Guid hallId,
        DateOnly date,
        CancellationToken cancellationToken = default)
    {
        var hall = await _hallRepository.GetHallByIdAsync(hallId, cancellationToken);
        if (hall is null || hall.IsDeleted || hall.Status != HallStatus.Approved)
        {
            _logger.LogInformation("Availability requested for non-public hall {HallId}.", hallId);
            throw new NotFoundException(nameof(Hall), hallId);
        }

        var periodsTask = _hallRepository.GetBookingPeriodsAsync([hallId], cancellationToken);
        var availabilityTask = _hallRepository.GetAvailabilityAsync([hallId], date, date, cancellationToken);
        await Task.WhenAll(periodsTask, availabilityTask);

        var statuses = availabilityTask.Result.ToDictionary(item => item.PeriodType, item => item.Status);
        var periods = periodsTask.Result
            .Select(period => new HallBookingPeriodStatusDto
            {
                PeriodType = period.Type,
                PeriodName = HallDisplayNames.GetPeriodName(period.Type),
                StartTime = period.StartTime,
                EndTime = period.EndTime,
                Status = statuses.TryGetValue(period.Type, out var status)
                    ? status
                    : AvailabilityStatus.Available
            })
            .ToList();

        return new HallAvailabilityDto { Date = date, Periods = periods };
    }
}
