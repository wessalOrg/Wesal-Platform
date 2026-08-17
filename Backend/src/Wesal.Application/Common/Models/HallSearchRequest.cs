using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

public class HallSearchRequest
{
    public string? Name { get; init; }

    public HallRegion? Region { get; init; }

    public string? Area { get; init; }

    public DateOnly? Date { get; init; }

    public BookingPeriodType? Period { get; init; }

    public int PageNumber { get; init; } = 1;

    public int PageSize { get; init; } = 12;
}
