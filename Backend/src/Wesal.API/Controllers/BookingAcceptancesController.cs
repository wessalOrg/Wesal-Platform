using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

/// <summary>
/// Accepts a pending booking request on behalf of the authenticated Hall Owner
/// (US-OWNER-11, FR-BOOK-01). Ownership and status eligibility are verified
/// exclusively from the JWT session and persisted records; the client can never
/// supply a trusted owner identity.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/halls/{hallId:guid}/bookings/{bookingId:guid}")]
public class BookingAcceptancesController : ControllerBase
{
    private readonly IBookingAcceptanceService _bookingAcceptanceService;

    public BookingAcceptancesController(IBookingAcceptanceService bookingAcceptanceService)
    {
        _bookingAcceptanceService = bookingAcceptanceService;
    }

    /// <summary>
    /// Accepts a pending booking request (US-OWNER-11), stating the deposit
    /// (عربون) the requester must pay. The request transitions from Pending to
    /// Accepted and the deposit is recorded; the hours stay reserved so no
    /// competing request can take them, and they are NOT marked Booked yet.
    /// Booking the hall is a separate, deliberate step: the owner confirms the
    /// deposit was received, which is when the hours become officially booked.
    /// The requester is notified on the booking conversation with the amount due.
    /// Ownership and status eligibility are verified server-side from the JWT
    /// session and persisted records; the client cannot supply a trusted owner id.
    /// A race between accept and cancel is resolved atomically at the database
    /// level; exactly one wins and the loser receives a 409 Conflict.
    /// </summary>
    /// <remarks>
    /// WESAL-TASK-8 (Edit 8): a request body with <c>depositAmount</c> is now
    /// required. Previously this endpoint took no body; that call shape is no
    /// longer accepted, because an approval without a deposit amount is not a
    /// complete approval.
    /// </remarks>
    [HttpPost("accept")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(AcceptBookingResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AcceptBookingResultDto>> AcceptBooking(
        Guid hallId,
        Guid bookingId,
        [FromBody] AcceptBookingRequestDto request,
        CancellationToken cancellationToken)
    {
        var result = await _bookingAcceptanceService.AcceptBookingAsync(
            hallId,
            bookingId,
            request,
            cancellationToken);

        return Ok(result);
    }
}
