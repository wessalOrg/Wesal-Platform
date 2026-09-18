using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

/// <summary>
/// Permanently deletes a booking from the Hall Owner's own hall's schedule
/// (US-OWNER-15). Ownership and existence are verified exclusively from the JWT
/// session and persisted records; the client can never supply a trusted owner
/// identity. Deleting a published booking clears its public 'Booked' status by
/// re-opening the exact requested period. The operation is atomic: a concurrent
/// deletion or state change leaves the state unchanged and the caller receives a
/// 409 Conflict.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/halls/{hallId:guid}/bookings/{bookingId:guid}")]
public class BookingDeletionsController : ControllerBase
{
    private readonly IBookingDeletionService _bookingDeletionService;

    public BookingDeletionsController(IBookingDeletionService bookingDeletionService)
    {
        _bookingDeletionService = bookingDeletionService;
    }

    /// <summary>
    /// Permanently deletes the booking (US-OWNER-15). Only the hall's owner can
    /// delete it. The deleted booking's exact requested period is released back to
    /// Available when no other active booking claims it, which also clears the
    /// public 'Booked' status of a published booking. Conversation history and the
    /// rejected-booking notification message are retained. A concurrent deletion or
    /// a state change that already processed the booking surfaces as 409 Conflict.
    /// </summary>
    [HttpPost("delete")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(DeleteBookingResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<DeleteBookingResultDto>> DeleteBooking(
        Guid hallId,
        Guid bookingId,
        CancellationToken cancellationToken)
    {
        var result = await _bookingDeletionService.DeleteBookingAsync(hallId, bookingId, cancellationToken);

        return Ok(result);
    }
}