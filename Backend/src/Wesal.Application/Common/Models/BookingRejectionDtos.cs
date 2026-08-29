using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

public class RejectBookingRequestDto
{
    public string Reason { get; init; } = string.Empty;
}

public class RejectBookingResultDto
{
    public Guid BookingId { get; init; }

    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public DateOnly Date { get; init; }

    public BookingPeriodType Period { get; init; }

    public string RequesterUserId { get; init; } = string.Empty;

    public string RejectionReason { get; init; } = string.Empty;

    public BookingRejectionNotificationStatus NotificationStatus { get; init; }

    public bool IsAlreadyRejected { get; init; }
}