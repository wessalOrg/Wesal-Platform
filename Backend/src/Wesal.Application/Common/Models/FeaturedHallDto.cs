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

    public IReadOnlyList<HallHourlySlotDto> Slots { get; init; } = [];
}
