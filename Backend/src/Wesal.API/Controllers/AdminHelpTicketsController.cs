using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

/// <summary>
/// Admin-only review of the Help Center queue: every ticket, newest first, and the reply
/// action. A reply raises the owner's unread flag so the answer is waiting for them.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/admin/help/tickets")]
[Authorize(Policy = ApplicationPolicies.RequireAdmin)]
public sealed class AdminHelpTicketsController(IHelpTicketsService tickets) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<HelpTicketDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PagedResult<HelpTicketDto>>> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
        => Ok(await tickets.ListAllAsync(page, pageSize, cancellationToken));

    [HttpPost("{id:guid}/reply")]
    [ProducesResponseType(typeof(HelpTicketDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<HelpTicketDto>> Reply(
        Guid id,
        [FromBody] ReplyHelpTicketRequestDto request,
        CancellationToken cancellationToken)
        => Ok(await tickets.ReplyAsync(id, request, cancellationToken));

    [HttpPost("conversations/{userId}/read")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> MarkConversationRead(
        [FromRoute] string userId,
        CancellationToken cancellationToken)
    {
        await tickets.MarkConversationReadAsync(userId, cancellationToken);
        return NoContent();
    }
}
