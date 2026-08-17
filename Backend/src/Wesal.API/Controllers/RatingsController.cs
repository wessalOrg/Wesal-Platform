using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/ratings")]
public class RatingsController : ControllerBase
{
    private readonly IRatingService _ratingService;

    public RatingsController(IRatingService ratingService)
    {
        _ratingService = ratingService;
    }

    [HttpPost]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(RatingResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<RatingResponse>> CreateRating(
        [FromBody] CreateRatingRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _ratingService.CreateRatingAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetHallRatingSummary), new { hallId = response.HallId }, response);
    }

    [HttpPut]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(RatingResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RatingResponse>> UpdateRating(
        [FromBody] UpdateRatingRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _ratingService.UpdateRatingAsync(request, cancellationToken);
        return Ok(response);
    }

    [HttpGet("hall/{hallId:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(HallRatingSummary), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<HallRatingSummary>> GetHallRatingSummary(
        Guid hallId,
        CancellationToken cancellationToken)
    {
        var summary = await _ratingService.GetHallRatingSummaryAsync(hallId, cancellationToken);
        return Ok(summary);
    }
}
