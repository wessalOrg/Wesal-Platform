namespace Wesal.Application.Common.Models;

/// <summary>
/// Owner-facing request to block or unblock one whole calendar day for a hall
/// (WESAL-TASK-1). Mirrors the shape of <see cref="UpdateOwnerAvailabilityRequest"/>:
/// a single date plus the desired state.
/// </summary>
public class OwnerDayBlockRequest
{
    /// <summary>The calendar day to block or unblock. Must not be in the past.</summary>
    public DateOnly Date { get; init; }

    /// <summary>
    /// false blocks the whole day (no slot is bookable, and the seeker catalog and
    /// calendar report it as closed); true reopens the day.
    /// </summary>
    public bool IsOpen { get; init; } = true;
}

/// <summary>Authoritative persisted state of one hall's day gate after an owner change.</summary>
public class OwnerDayBlockResultDto
{
    public Guid HallId { get; init; }

    public DateOnly Date { get; init; }

    public bool IsOpen { get; init; }
}

/// <summary>
/// Owner-facing request to change a hall's hourly-slot presentation settings
/// (WESAL-TASK-1). Both properties are optional so an owner can change the display
/// toggle without restating the window, and vice versa; an omitted property keeps its
/// current persisted value. Toggling ShowBookedSlots is a display-only change and never
/// re-validates or alters existing bookings.
/// </summary>
public class UpdateOwnerHourlySettingsRequest
{
    /// <summary>
    /// When false, booked hourly slots are hidden from seekers entirely. null leaves the
    /// current setting unchanged.
    /// </summary>
    public bool? ShowBookedSlots { get; init; }

    /// <summary>First bookable hour of the day. null leaves the current window start unchanged.</summary>
    public TimeOnly? HourlySlotStart { get; init; }

    /// <summary>End of the bookable window (exclusive). null leaves the current window end unchanged.</summary>
    public TimeOnly? HourlySlotEnd { get; init; }
}

/// <summary>Authoritative persisted hourly-slot settings for a hall after an owner change.</summary>
public class OwnerHourlySettingsDto
{
    public Guid HallId { get; init; }

    public bool ShowBookedSlots { get; init; }

    /// <summary>The effective window start (the 09:00 default when never configured).</summary>
    public TimeOnly HourlySlotStart { get; init; }

    /// <summary>The effective window end (the 22:00 default when never configured).</summary>
    public TimeOnly HourlySlotEnd { get; init; }
}
