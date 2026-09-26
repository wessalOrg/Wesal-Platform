using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

public class HallSearchRequest
{
    public string? Name { get; init; }

    public HallRegion? Region { get; init; }

    public string? Area { get; init; }

    /// <summary>
    /// Free-text filter over the owner's DetailedAddress (WESAL-TASK-7, Edit 7). Kept
    /// separate from <see cref="Area"/> on purpose: Area matches the list-backed Address,
    /// while this matches the owner's own free-text directions. Both are optional and
    /// combine with AND.
    /// </summary>
    public string? DetailedAddress { get; init; }

    public DateOnly? Date { get; init; }

    public TimeOnly? StartTime { get; init; }

    public int PageNumber { get; init; } = 1;

    public int PageSize { get; init; } = 12;
}
