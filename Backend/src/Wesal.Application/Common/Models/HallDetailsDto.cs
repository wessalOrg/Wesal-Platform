using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

public class HallDetailsDto
{
    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public string Region { get; init; } = string.Empty;

    public string Address { get; init; } = string.Empty;

    public string? Description { get; init; }

    public int Capacity { get; init; }

    public decimal? Price { get; init; }

    public string? ContactPhone { get; init; }

    public HallStatus Status { get; init; }

    public bool IsOwner { get; init; }

    public IReadOnlyList<HallImageDto> Photos { get; init; } = [];

    public IReadOnlyList<HallAvailabilityDto> Availability { get; init; } = [];
}

public class HallImageDto
{
    public Guid Id { get; init; }

    public string Url { get; init; } = string.Empty;
}
