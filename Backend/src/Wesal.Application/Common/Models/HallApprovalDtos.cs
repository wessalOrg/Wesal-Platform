using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

public class HallApprovalResponse
{
    public Guid HallId { get; init; }
    public string HallName { get; init; } = string.Empty;
    public HallStatus Status { get; init; }
    public bool IsApproved => Status == HallStatus.Approved;
    public DateTimeOffset ApprovedAt { get; init; }
}

public class HallSearchIndexDto
{
    public Guid HallId { get; init; }
    public string HallName { get; init; } = string.Empty;
    public HallRegion Region { get; init; }
    public string Address { get; init; } = string.Empty;
    public string? Description { get; init; }
    public int Capacity { get; init; }
    public decimal? Price { get; init; }
    public HallStatus Status { get; init; }
}
