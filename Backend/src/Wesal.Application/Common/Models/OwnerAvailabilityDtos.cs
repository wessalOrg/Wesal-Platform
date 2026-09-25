using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

public class OwnerAvailabilityDayDto
{
    public DateOnly Date { get; init; }

    /// <summary>
    /// WESAL-TASK-1 hardening: the owner day gate for this date. false means the owner
    /// blocked the whole day via the day-block endpoint, so no period on it is bookable.
    /// Defaults to true because a date with no explicit day-gate row is open, matching the
    /// domain rule. The owner always sees the true state here - the seeker-facing
    /// ShowBookedSlots toggle governs what seekers see and must never hide it from the
    /// owner who set it.
    /// </summary>
    public bool IsOpen { get; init; } = true;

    public IReadOnlyList<OwnerAvailabilityPeriodDto> Periods { get; init; } = [];
}

public class OwnerAvailabilityPeriodDto
{
    public BookingPeriodType PeriodType { get; init; }
    public TimeOnly StartTime { get; init; }
    public TimeOnly EndTime { get; init; }
    public AvailabilityStatus Status { get; init; }
}

public class OwnerAvailabilityCalendarDto
{
    public Guid HallId { get; init; }
    public DateOnly FromDate { get; init; }
    public DateOnly ToDate { get; init; }
    public IReadOnlyList<OwnerAvailabilityDayDto> Days { get; init; } = [];
}

public class UpdateOwnerAvailabilityRequest
{
    public DateOnly Date { get; init; }
    public BookingPeriodType PeriodType { get; init; }
    public AvailabilityStatus Status { get; init; }
}
