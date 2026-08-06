using Wesal.Domain.Enums;

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

    public IReadOnlyList<HallBookingPeriodStatusDto> Periods { get; init; } = [];
}

public class HallBookingPeriodStatusDto
{
    public BookingPeriodType PeriodType { get; init; }

    public string PeriodName { get; init; } = string.Empty;

    public TimeOnly StartTime { get; init; }

    public TimeOnly EndTime { get; init; }

    public AvailabilityStatus Status { get; init; }
}
