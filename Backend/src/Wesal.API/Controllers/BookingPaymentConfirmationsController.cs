using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

/// <summary>
/// WESAL-TASK-8 (Edit 8): the Hall Owner confirms the deposit (عربون) was received,
/// which is the step that officially books a booking.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/halls/{hallId:guid}/bookings/{bookingId:guid}")]
public class BookingPaymentConfirmationsController : ControllerBase
{
    private readonly IBookingPaymentConfirmationService _bookingPaymentConfirmationService;

    public BookingPaymentConfirmationsController(
        IBookingPaymentConfirmationService bookingPaymentConfirmationService)
    {
        _bookingPaymentConfirmationService = bookingPaymentConfirmationService;
    }

    /// <summary>
    /// Confirms the deposit for an approved booking and books its hours. The booking's
    /// reserved hours become officially booked, and from this moment the booking can no
    /// longer be rejected or cancelled. Ownership is verified server-side from the JWT
    /// session and the persisted hall, so one owner can never confirm another owner's
    /// booking. A concurrent or repeated confirmation is rejected with 409, and a booking
    /// that no longer holds its hours is not confirmed at all.
    /// </summary>
    [HttpPut("payment/confirmed")]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(ConfirmBookingPaymentResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ConfirmBookingPaymentResultDto>> ConfirmBookingPayment(
        Guid hallId,
        Guid bookingId,
        CancellationToken cancellationToken)
    {
        var result = await _bookingPaymentConfirmationService.ConfirmPaymentAsync(
            hallId,
            bookingId,
            cancellationToken);

        return Ok(result);
    }
}
