using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Owner-facing management of a hall's hourly-slot availability (WESAL-TASK-1):
/// blocking/unblocking an entire calendar day, and changing the hall's hourly window
/// and the "show booked slots" display toggle. Kept separate from the seeker-facing
/// <see cref="IHourlySlotService"/> so the owner management surface and the public
/// booking surface have distinct contracts, mirroring the existing split between
/// IOwnerAvailabilityService and IBookingRequestService.
/// </summary>
public interface IOwnerHourlyAvailabilityService
{
    /// <summary>
    /// Blocks (isOpen = false) or reopens (isOpen = true) one whole calendar day for the
    /// authenticated owner's hall. Ownership is resolved server-side. Blocking a day that
    /// already carries a live (Pending or Accepted) booking is refused with a conflict so
    /// a confirmed booking is never silently orphaned. The date must not be in the past.
    /// </summary>
    Task<OwnerDayBlockResultDto> SetDayBlockAsync(
        Guid hallId,
        OwnerDayBlockRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Updates the owner's hourly-slot settings: the ShowBookedSlots display toggle and
    /// the bookable window (HourlySlotStart / HourlySlotEnd). Any omitted property keeps
    /// its current persisted value; the effective window must stay ordered (start &lt;
    /// end) and consist of whole 60-minute slots. This never alters existing bookings.
    /// </summary>
    Task<OwnerHourlySettingsDto> UpdateHourlySettingsAsync(
        Guid hallId,
        UpdateOwnerHourlySettingsRequest request,
        CancellationToken cancellationToken = default);
}
