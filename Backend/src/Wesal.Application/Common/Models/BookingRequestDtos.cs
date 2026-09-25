using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

public class BookingRequestDto
{
    public Guid HallId { get; init; }

    public DateOnly Date { get; init; }

    public IReadOnlyList<BookingPeriodType> Periods { get; init; } = [];

    /// <summary>
    /// WESAL-TASK-1 hardening: the full name the seeker enters for this specific booking.
    /// Required, and persisted to <see cref="Wesal.Domain.Entities.Booking.NameOnBooking"/>,
    /// exactly as on the hourly booking path. Previously the legacy path created bookings
    /// with no name at all, so requirement 6 silently did not hold here.
    /// </summary>
    public string NameOnBooking { get; init; } = string.Empty;
}

public class BookingRequestValidationResultDto
{
    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public DateOnly Date { get; init; }

    public IReadOnlyList<BookingPeriodType> Periods { get; init; } = [];
}

public class BookingRequestResultDto
{
    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public DateOnly Date { get; init; }

    public string RequesterUserId { get; init; } = string.Empty;

    public BookingStatus Status { get; init; } = BookingStatus.Pending;

    public IReadOnlyList<CreatedBookingDto> Periods { get; init; } = [];
}

public class CreatedBookingDto
{
    public Guid BookingId { get; init; }

    public BookingPeriodType Period { get; init; }

    public BookingStatus Status { get; init; } = BookingStatus.Pending;
}
