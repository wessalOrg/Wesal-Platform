using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Permanently deletes a booking on behalf of the authenticated Hall Owner
/// (US-OWNER-15). The owner is resolved exclusively from the authenticated session
/// and the persisted hall owner id; the client can never supply a trusted owner
/// identity. Deletion removes the booking row and re-opens its exact
/// HallAvailability period (clearing any public 'Booked' status) inside a single
/// database transaction, without ever touching other bookings, unrelated periods,
/// or conversation history.
/// </summary>
public interface IBookingDeletionService
{
    Task<DeleteBookingResultDto> DeleteBookingAsync(
        Guid hallId,
        Guid bookingId,
        CancellationToken cancellationToken = default);
}