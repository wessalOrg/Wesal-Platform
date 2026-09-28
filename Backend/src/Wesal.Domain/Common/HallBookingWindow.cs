using Wesal.Domain.Entities;

namespace Wesal.Domain.Common;

/// <summary>
/// Single source of truth for the hall's authoritative hourly booking window
/// (final audit, Edits 16-19/22-29). Every surface — the seeker catalog, booking
/// creation, owner settings, hall search and the details availability — derives its
/// window from the hall's <see cref="Hall.HourlySlotStart"/> /
/// <see cref="Hall.HourlySlotEnd"/> with these defaults when unconfigured, so the
/// rules cannot drift apart between readers.
/// </summary>
public static class HallBookingWindow
{
    /// <summary>Default first bookable hour when the owner never configured one.</summary>
    public static readonly TimeOnly DefaultStart = new(9, 0);

    /// <summary>Default end (exclusive) of the bookable window when unconfigured.</summary>
    public static readonly TimeOnly DefaultEnd = new(22, 0);

    /// <summary>Effective window start for the hall (configured value or default).</summary>
    public static TimeOnly EffectiveStart(Hall? hall)
        => hall?.HourlySlotStart ?? DefaultStart;

    /// <summary>Effective window end (exclusive) for the hall.</summary>
    public static TimeOnly EffectiveEnd(Hall? hall)
        => hall?.HourlySlotEnd ?? DefaultEnd;

    /// <summary>
    /// Whether a whole-hour slot start falls inside the hall's bookable window
    /// [start, end). A null hall uses the defaults, matching every reader.
    /// </summary>
    public static bool Contains(Hall? hall, TimeOnly slotStart)
        => EffectiveStart(hall) <= slotStart && slotStart < EffectiveEnd(hall);
}
