using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

/// <summary>
/// The authenticated Regular User's own booking history ("My bookings"). The
/// RequireAuthenticatedUser policy gates the endpoint, and the requester is resolved
/// exclusively from the authenticated session inside the service, so a caller can never
/// read another user's bookings. The read is strictly passive.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/bookings")]
[Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
public class BookingsController : ControllerBase
{
    private readonly IUserBookingsService _userBookingsService;

    public BookingsController(IUserBookingsService userBookingsService)
    {
        _userBookingsService = userBookingsService;
    }

    /// <summary>
    /// Returns every booking submitted by the authenticated user across all halls, newest
    /// day first, including Pending, Accepted, Rejected, and Cancelled entries. The
    /// requester is taken from the session, never from client input.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<UserBookingDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IReadOnlyList<UserBookingDto>>> GetMyBookings(
        CancellationToken cancellationToken)
    {
        var bookings = await _userBookingsService.GetMyBookingsAsync(cancellationToken);
        return Ok(bookings);
    }
}
