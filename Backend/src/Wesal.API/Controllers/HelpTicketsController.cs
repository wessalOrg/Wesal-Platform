using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

/// <summary>
/// The signed-in user's Help Center ("مركز المساعدة") tickets. Filing and reading are scoped to
/// the session, so a caller can never act on somebody else's ticket.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/help/tickets")]
[Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
public sealed class HelpTicketsController(IHelpTicketsService tickets) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(HelpTicketDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<HelpTicketDto>> Create(
        [FromBody] CreateHelpTicketRequestDto request,
        CancellationToken cancellationToken)
    {
        var created = await tickets.CreateAsync(request, cancellationToken);
        return Created($"/api/v1/help/tickets/{created.Id}", created);
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<HelpTicketDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IReadOnlyList<HelpTicketDto>>> ListMine(CancellationToken cancellationToken)
        => Ok(await tickets.ListMineAsync(cancellationToken));

    [HttpPost("{id:guid}/read")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken cancellationToken)
    {
        await tickets.MarkReadAsync(id, cancellationToken);
        return NoContent();
    }
}
