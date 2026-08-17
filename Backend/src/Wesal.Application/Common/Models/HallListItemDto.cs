namespace Wesal.Application.Common.Models;

public class HallListItemDto
{
    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public string? MainImage { get; init; }

    public string Region { get; init; } = string.Empty;

    public string Address { get; init; } = string.Empty;

    public int Capacity { get; init; }

    public decimal? Price { get; init; }

    public string? Description { get; init; }
}
