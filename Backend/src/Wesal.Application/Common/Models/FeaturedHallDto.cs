namespace Wesal.Application.Common.Models;

public class FeaturedHallDto
{
    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public string? MainImage { get; init; }

    public string Region { get; init; } = string.Empty;

    public string Address { get; init; } = string.Empty;

    public int Capacity { get; init; }

    public decimal? Price { get; init; }

    public string? ShortDescription { get; init; }

    public IReadOnlyList<HallAvailabilityDto> Availability { get; init; } = [];
}

public class HallAvailabilityDto
{
    public DateOnly Date { get; init; }

    /// <summary>
    /// Mirrors <see cref="HallHourlyCatalogDto.DayOpen"/> (WESAL-TASK-5, Edit 5) so the
    /// embedded per-day availability agrees with the dedicated hourly-catalog endpoint
    /// for the same hall and date. False means the owner blocked the whole day, which the
    /// dedicated endpoint reports as DayOpen=false; without this the embedded list could
    /// not tell a blocked day apart from a day whose hours are all already booked. A
    /// blocked day is only ever reported as closed while the hall has ShowBookedSlots ON.
    /// </summary>
    public bool DayOpen { get; init; }

    public IReadOnlyList<HallHourlySlotDto> Slots { get; init; } = [];
}
