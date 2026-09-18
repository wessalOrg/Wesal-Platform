using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

/// <summary>
/// Result returned after a booking request has been successfully accepted by the
/// Hall Owner (US-OWNER-11). The period remains protected (reserved) so that no
/// competing booking can take it; the period is NOT permanently marked as Booked
/// because the deposit-confirmation workflow (US-BOOK-05 / FR-BOOK-05) is not yet
/// implemented and the booking stays in the Accepted (deposit-pending) state.
/// </summary>
public class AcceptBookingResultDto
{
    public Guid BookingId { get; init; }

    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public string RequesterUserId { get; init; } = string.Empty;

    public DateOnly Date { get; init; }

    public BookingPeriodType Period { get; init; }

    public BookingStatus Status { get; init; } = BookingStatus.Accepted;
}
