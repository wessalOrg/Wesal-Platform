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
public class BookingRejectionsController : ControllerBase
{
    private readonly IBookingRejectionService _bookingRejectionService;

    public BookingRejectionsController(IBookingRejectionService bookingRejectionService)
    {
        _bookingRejectionService = bookingRejectionService;
    }

    [HttpPost("reject")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(RejectBookingResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RejectBookingResultDto>> RejectBooking(
        Guid hallId,
        Guid bookingId,
        [FromBody] RejectBookingRequestDto request,
        CancellationToken cancellationToken)
    {
        var result = await _bookingRejectionService.RejectBookingAsync(hallId, bookingId, request, cancellationToken);

        return Ok(result);
    }
}