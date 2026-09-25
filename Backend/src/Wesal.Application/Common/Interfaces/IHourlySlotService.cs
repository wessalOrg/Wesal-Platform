using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Seeker-facing hourly-slot availability and booking (WESAL-TASK-1). Additive to
/// the legacy <see cref="IBookingRequestService"/> two-period flow, which stays
/// dormant and unchanged.
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
