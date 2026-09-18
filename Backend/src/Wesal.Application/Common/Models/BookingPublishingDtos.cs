using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

/// <summary>
/// Result returned after the Hall Owner has published an accepted booking's
/// period as Booked (US-OWNER-13). The booking stays in the Accepted state;
/// IsPublished flags that its exact HallAvailability period has been
/// permanently marked as Booked and excluded from public availability.
/// </summary>
public class PublishBookingResultDto
{
    public Guid BookingId { get; init; }

    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public string RequesterUserId { get; init; } = string.Empty;

    public DateOnly Date { get; init; }

    public BookingPeriodType Period { get; init; }

    public BookingStatus Status { get; init; } = BookingStatus.Accepted;

    public bool IsPublished { get; init; }
}