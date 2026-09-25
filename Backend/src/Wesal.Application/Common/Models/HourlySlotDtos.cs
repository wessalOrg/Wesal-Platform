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
/// requested range, whether the day is available for hourly seeking. A day with no
/// explicit owner gate defaults to open.
///
/// A day the owner has fully blocked is treated exactly like a day whose hours are all
/// already booked, and is governed by the same <see cref="Hall.ShowBookedSlots"/> rule as
/// any booked slot. With the toggle ON the day is disclosed as not open; with the toggle
/// OFF it is deliberately indistinguishable from a hidden fully-booked day and reads as
/// open, so the block is never leaked. A blocked day is never reported through a distinct
/// "Closed" status of its own.
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

    /// <summary>
    /// true = seekable day. false only while <see cref="Hall.ShowBookedSlots"/> is ON and
    /// the owner blocked the day; with the toggle OFF a blocked day reports true, exactly
    /// as a hidden fully-booked day does.
    /// </summary>
    public bool IsOpen { get; init; }
}

/// <summary>
/// Seeker request to book one or more 60-minute slots at one hall on one date.
/// </summary>
public class HourlyBookingRequestDto
{
    public Guid HallId { get; init; }

    public DateOnly Date { get; init; }

    public IReadOnlyList<TimeOnly> SlotStarts { get; init; } = [];

    public string NameOnBooking { get; init; } = string.Empty;

    public string RequesterName { get; init; } = string.Empty;
}

/// <summary>
/// Result of booking one or more 60-minute slots at one hall on one date.
/// </summary>
public class HourlyBookingResultDto
{
    public Guid BookingId { get; init; }

    public Guid HallId { get; init; }

    public DateOnly Date { get; init; }

    public IReadOnlyList<TimeOnly> SlotStarts { get; init; } = [];

    public string TimeRange { get; init; } = string.Empty;

    public BookingStatus Status { get; init; } = BookingStatus.Pending;
}
