using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

/// <summary>
/// The hourly seeking day view (WESAL-TASK-1, seeker side). For one hall on one
/// date it returns that date's per-day gate and the individual 60-minute hourly
/// slots from the hall's daily window (<see cref="Hall.HourlySlotStart"/> to
/// <see cref="Hall.HourlySlotEnd"/>).
/// </summary>
public class HallHourlyCatalogDto
{
    public Guid HallId { get; init; }

    public DateOnly Date { get; init; }

    /// <summary>false when the whole day is blocked by the owner (day gate closed).</summary>
    public bool DayOpen { get; init; }

    /// <summary>
    /// When the hall's ShowBookedSlots is ON: every hourly slot of the day window is
    /// returned, booked ones marked Booked. When OFF: only available slots appear
    /// (booked hours are hidden from seekers per owner preference).
    /// </summary>
    public IReadOnlyList<HallHourlySlotDto> Slots { get; init; } = [];
}

public class HallHourlySlotDto
{
    /// <summary>The 60-minute slot's start, e.g. 10:00.</summary>
    public TimeOnly StartTime { get; init; }

    public TimeOnly EndTime { get; init; }

    public HallSlotStatus Status { get; init; } = HallSlotStatus.Available;

    /// <summary>When this hourly slot is already booked (useful only when ShowBookedSlots=ON).</summary>
    public bool IsBooked => Status == HallSlotStatus.Booked;
}

/// <summary>
/// Calendar view the seeker uses to pick a date (WESAL-TASK-1): for each day in the
/// requested range, whether the day is available for hourly seeking (owner has not
/// blocked it). Days the owner blocked are reported explicitly as Closed so the
/// seeker can never silently pick them.
/// </summary>
public class HallHourlyCalendarDto
{
    public Guid HallId { get; init; }

    public DateOnly FromDate { get; init; }

    public DateOnly ToDate { get; init; }

    public IReadOnlyList<HallHourlyCalendarDayDto> Days { get; init; } = [];
}

public class HallHourlyCalendarDayDto
{
    public DateOnly Date { get; init; }

    /// <summary>true = seekable day, false = owner blocked (Closed).</summary>
    public bool IsOpen { get; init; }
}

public class HourlyBookingRequestDto
{
    public Guid HallId { get; init; }

    public DateOnly Date { get; init; }

    public TimeOnly SlotStart { get; init; }

    public string NameOnBooking { get; init; } = string.Empty;

    public string RequesterName { get; init; } = string.Empty;
}

public class HourlyBookingResultDto
{
    public Guid BookingId { get; init; }

    public Guid HallId { get; init; }

    public DateOnly Date { get; init; }

    public TimeOnly SlotStart { get; init; }

    public BookingStatus Status { get; init; } = BookingStatus.Pending;
}
