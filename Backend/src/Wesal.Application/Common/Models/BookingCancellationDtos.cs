using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

public class CancelBookingResultDto
{
    public Guid BookingId { get; init; }

    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public string RequesterUserId { get; init; } = string.Empty;

    public DateOnly Date { get; init; }

    public BookingPeriodType Period { get; init; }

    public BookingStatus Status { get; init; } = BookingStatus.Cancelled;
}