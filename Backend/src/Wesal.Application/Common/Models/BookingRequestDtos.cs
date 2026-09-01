using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

public class BookingRequestDto
{
    public Guid HallId { get; init; }

    public DateOnly Date { get; init; }

    public IReadOnlyList<BookingPeriodType> Periods { get; init; } = [];
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
