using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

/// <summary>
/// The authenticated user's saved halls ("المفضلة"). The list is scoped to the session, and
/// the operations are idempotent, so the client can optimistically toggle and retry safely.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/favorites/halls")]
[Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
public sealed class HallFavoritesController(IHallFavoritesService favorites) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<Guid>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IReadOnlyList<Guid>>> List(CancellationToken cancellationToken)
        => Ok(await favorites.ListFavoriteHallIdsAsync(cancellationToken));

    [HttpPut("{hallId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Add(Guid hallId, CancellationToken cancellationToken)
    {
        await favorites.AddAsync(hallId, cancellationToken);
        return NoContent();
    }

    [HttpDelete("{hallId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Remove(Guid hallId, CancellationToken cancellationToken)
    {
        await favorites.RemoveAsync(hallId, cancellationToken);
        return NoContent();
    }
}
