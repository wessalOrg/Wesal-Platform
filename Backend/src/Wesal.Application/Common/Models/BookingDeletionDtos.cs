using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

/// <summary>
/// Result returned after the Hall Owner has permanently deleted a booking from
/// their hall's schedule (US-OWNER-15). The booking row is removed; the deleted
/// booking's exact HallAvailability period becomes Available again (when no other
/// active booking claims it), which also clears a published booking's public
/// 'Booked' status. Status and IsPublished echo the last persisted state of the
/// deleted booking, so a client can confirm whether a public 'Booked' period was
/// cleared as part of this deletion.
/// </summary>
public class DeleteBookingResultDto
{
    public Guid BookingId { get; init; }

    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public string RequesterUserId { get; init; } = string.Empty;

    public DateOnly Date { get; init; }

    public BookingPeriodType Period { get; init; }

    public BookingStatus Status { get; init; }

    public bool IsPublished { get; init; }
}