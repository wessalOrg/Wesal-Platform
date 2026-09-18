using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

public class HallPhotoUpload
{
    public string FileName { get; init; } = string.Empty;
    public string ContentType { get; init; } = string.Empty;
    public byte[] Content { get; init; } = [];
    public long Length => Content.Length;
}

public class CreateHallRequest
{
    public string Name { get; init; } = string.Empty;
    public string ContactPhone { get; init; } = string.Empty;
    public string Region { get; init; } = string.Empty;
    public string Address { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public int Capacity { get; init; }
    public decimal? Price { get; init; }
    public TimeOnly FirstPeriodStart { get; init; }
    public TimeOnly FirstPeriodEnd { get; init; }
    public TimeOnly SecondPeriodStart { get; init; }
    public TimeOnly SecondPeriodEnd { get; init; }
    public IReadOnlyList<HallPhotoUpload>? Photos { get; init; }
}

public class CreateHallResponse
{
    public Guid HallId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string ContactPhone { get; init; } = string.Empty;
    public HallRegion Region { get; init; }
    public string Address { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public int Capacity { get; init; }
    public decimal? Price { get; init; }
    public HallStatus Status { get; init; }
    public IReadOnlyList<HallBookingPeriodDto> BookingPeriods { get; init; } = [];
    public IReadOnlyList<HallImageDto> Images { get; init; } = [];
}

public class HallBookingPeriodDto
{
    public BookingPeriodType Type { get; init; }
    public TimeOnly StartTime { get; init; }
    public TimeOnly EndTime { get; init; }
}
