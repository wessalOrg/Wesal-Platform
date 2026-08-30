using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/halls/{hallId:guid}/bookings/{bookingId:guid}")]
public class BookingCancellationsController : ControllerBase
{
    private readonly IBookingCancellationService _bookingCancellationService;

    public BookingCancellationsController(IBookingCancellationService bookingCancellationService)
    {
        _bookingCancellationService = bookingCancellationService;
    }

    [HttpPost("cancel")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(CancelBookingResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CancelBookingResultDto>> CancelBooking(
        Guid hallId,
        Guid bookingId,
        CancellationToken cancellationToken)
    {
        var result = await _bookingCancellationService.CancelBookingAsync(hallId, bookingId, cancellationToken);

        return Ok(result);
    }
}