using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/bookings")]
public class BookingsController : ControllerBase
{
    private readonly IBookingRequestService _bookingRequestService;

    public BookingsController(IBookingRequestService bookingRequestService)
    {
        _bookingRequestService = bookingRequestService;
    }

    [HttpPost]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(BookingRequestValidationResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BookingRequestValidationResultDto>> SubmitBookingRequest(
        [FromBody] BookingRequestDto request,
        CancellationToken cancellationToken)
    {
        var result = await _bookingRequestService.ValidateBookingRequestAsync(request, cancellationToken);

        return Ok(result);
    }
}
