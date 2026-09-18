using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

/// <summary>
/// Publishes an accepted booking's booked period as Booked on behalf of the
/// authenticated Hall Owner (US-OWNER-13, FR-BOOK-06). Ownership and status
/// eligibility are verified exclusively from the JWT session and persisted
/// records; the client can never supply a trusted owner identity. A mandatory
/// final server-side availability re-check rejects the publication when any
/// other active booking claims the exact period, and the exact period is
/// guaranteed to be marked Booked.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/halls/{hallId:guid}/bookings/{bookingId:guid}")]
public class BookingPublicationsController : ControllerBase
{
    private readonly IBookingPublishingService _bookingPublishingService;

    public BookingPublicationsController(IBookingPublishingService bookingPublishingService)
    {
        _bookingPublishingService = bookingPublishingService;
    }

    /// <summary>
    /// Publishes an accepted booking's period as Booked (US-OWNER-13). Only the
    /// hall's owner can publish, and only a booking in the Accepted state that is
    /// not already published qualifies. A final server-side availability re-check
    /// guarantees the exact hall/date/period is still claimable by this booking
    /// alone before it is permanently marked Booked. The operation is atomic: a
    /// concurrent cancellation, another publication, or any competing active
    /// claim leaves the state unchanged and the caller receives a 409 Conflict.
    /// </summary>
    [HttpPost("publish")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(PublishBookingResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<PublishBookingResultDto>> PublishBooking(
        Guid hallId,
        Guid bookingId,
        CancellationToken cancellationToken)
    {
        var result = await _bookingPublishingService.PublishBookingAsync(hallId, bookingId, cancellationToken);

        return Ok(result);
    }
}