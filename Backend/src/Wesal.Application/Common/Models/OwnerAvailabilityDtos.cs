using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

public class OwnerAvailabilityDayDto
{
    public DateOnly Date { get; init; }
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
