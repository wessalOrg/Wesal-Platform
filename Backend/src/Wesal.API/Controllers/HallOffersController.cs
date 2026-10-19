using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
public sealed class HallOffersController(IHallOfferService offers) : ControllerBase
{
    [HttpPost("api/v{version:apiVersion}/owner/halls/{hallId:guid}/offers")]
    [Authorize(Policy = ApplicationPolicies.RequireHallOwner)]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(Guid hallId, [FromBody] CreateHallOfferRequest request, CancellationToken cancellationToken)
    {
        var id = await offers.CreateAsync(hallId, request, cancellationToken);
        return CreatedAtAction(nameof(ListOwn), new { version = "1", hallId }, new { id });
    }

    [HttpGet("api/v{version:apiVersion}/owner/halls/{hallId:guid}/offers")]
    [Authorize(Policy = ApplicationPolicies.RequireHallOwner)]
    [ProducesResponseType(typeof(PagedResult<HallOfferDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<HallOfferDto>>> ListOwn(Guid hallId, [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10, CancellationToken cancellationToken = default)
        => Ok(await offers.ListOwnAsync(hallId, page, pageSize, cancellationToken));

    [HttpPut("api/v{version:apiVersion}/owner/halls/{hallId:guid}/offers/{offerId:guid}")]
    [Authorize(Policy = ApplicationPolicies.RequireHallOwner)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Update(Guid hallId, Guid offerId, [FromBody] UpdateHallOfferRequest request, CancellationToken cancellationToken)
    {
        await offers.UpdateAsync(hallId, offerId, request, cancellationToken);
        return NoContent();
    }

    [HttpPost("api/v{version:apiVersion}/owner/halls/{hallId:guid}/offers/{offerId:guid}/stop")]
    [Authorize(Policy = ApplicationPolicies.RequireHallOwner)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Stop(Guid hallId, Guid offerId, CancellationToken cancellationToken)
    {
        await offers.StopAsync(hallId, offerId, cancellationToken);
        return NoContent();
    }

    [HttpGet("api/v{version:apiVersion}/halls/{hallId:guid}/offers/active")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(HallOfferDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<HallOfferDto>> GetActive(Guid hallId, CancellationToken cancellationToken)
        => await offers.GetActiveForHallAsync(hallId, cancellationToken) is { } offer ? Ok(offer) : NotFound();
}
