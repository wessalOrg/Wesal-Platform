using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

public sealed class HallSearchQuery
{
    public string? Name { get; init; }

    public HallRegion? Region { get; init; }

    public string? Address { get; init; }

    public DateOnly? Date { get; init; }

    public BookingPeriodType? Period { get; init; }
}
