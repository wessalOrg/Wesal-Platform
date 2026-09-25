using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;

namespace Wesal.Tests.TestDoubles;

internal sealed class FakeHourlySlotService : IHourlySlotService
{
    public Dictionary<DateOnly, HallHourlyCatalogDto> Catalogs { get; } = [];

    public HallHourlyCatalogDto? Response { get; set; }

    public Guid LastHallId { get; private set; }

    public DateOnly LastDate { get; private set; }

    /// <summary>
    /// Every (hall, date) pair requested, in call order. Lets a test pin that a caller
    /// delegates to the shared hourly catalog once per day instead of re-deriving
    /// availability itself (WESAL-TASK-5, Edit 5).
    /// </summary>
    public List<(Guid HallId, DateOnly Date)> Calls { get; } = [];

    public Task<HallHourlyCatalogDto> GetHourlyCatalogAsync(
        Guid hallId,
        DateOnly date,
        CancellationToken cancellationToken = default)
    {
        LastHallId = hallId;
        LastDate = date;
        Calls.Add((hallId, date));

        if (Response is not null)
        {
            return Task.FromResult(Response);
        }

        return Task.FromResult(Catalogs.TryGetValue(date, out var catalog)
            ? catalog
            : new HallHourlyCatalogDto
            {
                HallId = hallId,
                Date = date,
                DayOpen = true,
                Slots =
                [
                    new HallHourlySlotDto { StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(10, 0) },
                    new HallHourlySlotDto { StartTime = new TimeOnly(10, 0), EndTime = new TimeOnly(11, 0) },
                    new HallHourlySlotDto { StartTime = new TimeOnly(11, 0), EndTime = new TimeOnly(12, 0) }
                ]
            });
    }

    public Task<HallHourlyCalendarDto> GetAvailabilityCalendarAsync(
        Guid hallId,
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken = default)
        => Task.FromResult(new HallHourlyCalendarDto { HallId = hallId, FromDate = fromDate, ToDate = toDate });

    public Task<HourlyBookingResultDto> CreateHourlyBookingAsync(
        HourlyBookingRequestDto request,
        CancellationToken cancellationToken = default)
        => throw new NotSupportedException();
}
