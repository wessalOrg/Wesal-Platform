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
    /// Accepts a pending booking request (US-OWNER-11). The request transitions
    /// from Pending to Accepted; the period remains protected (reserved) so no
    /// competing booking can take it. The period is NOT permanently marked as
    /// Booked because the deposit workflow (US-BOOK-05) is not yet implemented.
    /// Ownership and status eligibility are verified server-side from the JWT
    /// session and persisted records; the client cannot supply a trusted owner id.
    /// A race between accept and cancel is resolved atomically at the database
    /// level; exactly one wins and the loser receives a 409 Conflict.
    /// </summary>
    [HttpPost("accept")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(AcceptBookingResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AcceptBookingResultDto>> AcceptBooking(
        Guid hallId,
        Guid bookingId,
        CancellationToken cancellationToken)
    {
        var result = await _bookingAcceptanceService.AcceptBookingAsync(hallId, bookingId, cancellationToken);

        return Ok(result);
    }
}
