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
