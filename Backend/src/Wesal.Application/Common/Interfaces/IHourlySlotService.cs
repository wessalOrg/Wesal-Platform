using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Seeker-facing hourly-slot availability and booking (WESAL-TASK-1). This is the
/// only booking availability model; the legacy two-period flow has been removed.
/// </summary>
public interface IHourlySlotService
{
    Task<HallHourlyCatalogDto> GetHourlyCatalogAsync(
        Guid hallId,
        DateOnly date,
        CancellationToken cancellationToken = default);

    Task<HallHourlyCalendarDto> GetAvailabilityCalendarAsync(
        Guid hallId,
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken = default);

    Task<HourlyBookingResultDto> CreateHourlyBookingAsync(
        HourlyBookingRequestDto request,
        CancellationToken cancellationToken = default);
}
