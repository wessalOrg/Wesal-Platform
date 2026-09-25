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
        var blockedTask = _hallRepository.GetBlockedDayHallIdsAsync([hallId], date, date, cancellationToken);
        await Task.WhenAll(periodsTask, availabilityTask, blockedTask);

        // WESAL-TASK-1 hardening: a day the owner blocked is unbookable in full, so it must
        // read as entirely unavailable here too. This is the endpoint behind the MCP
        // check_hall_availability tool and the AI assistant's availability answer, and
        // without this a blocked day was reported as "fully available".
        //
        // The whole day is reported as Booked rather than as a separate "blocked" status
        // on purpose: Booked is the vocabulary this contract already uses for "not
        // available", and reusing it means a blocked day is indistinguishable from a fully
        // booked one, so the response never discloses that the owner closed the day. That
        // keeps the seeker-facing output identical to how hidden booked time behaves when
        // ShowBookedSlots is OFF.
        var dayBlocked = blockedTask.Result.Contains(hallId);

        var statuses = availabilityTask.Result.ToDictionary(item => item.PeriodType, item => item.Status);
        var periods = periodsTask.Result
            .Select(period => new HallBookingPeriodStatusDto
            {
                PeriodType = period.Type,
                PeriodName = HallDisplayNames.GetPeriodName(period.Type),
                StartTime = period.StartTime,
                EndTime = period.EndTime,
                Status = dayBlocked
                    ? AvailabilityStatus.Booked
                    : statuses.TryGetValue(period.Type, out var status)
                        ? status
                        : AvailabilityStatus.Available
            })
            .ToList();

        return new HallAvailabilityDto { Date = date, Periods = periods };
    }
}
