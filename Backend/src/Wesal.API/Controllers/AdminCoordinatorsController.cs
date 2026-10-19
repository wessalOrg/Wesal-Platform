using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

/// <summary>
/// Administrator-only reads of Event Coordinator setup submissions (WESAL coordinator
/// setup). Deliberately minimal — just enough for an administrator to verify a
/// submitted personal ID document. The full review workflow (approve/reject) arrives
/// with Tasks 5/6. The document is streamed from the private store through this
/// authenticated, admin-authorized endpoint; no public URL exists for it.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/admin/coordinators")]
[Authorize(Policy = ApplicationPolicies.RequireAdmin)]
public class AdminCoordinatorsController : ControllerBase
{
    private readonly ICoordinatorAdminService _coordinatorAdminService;

    public AdminCoordinatorsController(ICoordinatorAdminService coordinatorAdminService)
    {
        _coordinatorAdminService = coordinatorAdminService;
    }

    /// <summary>
    /// Streams a coordinator's personal ID document, needed to verify the coordinator
    /// before approving the account. Only the Admin can read it.
    /// </summary>
    [HttpGet("{userId}/identity-document")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCoordinatorIdentityDocument(string userId, CancellationToken cancellationToken)
    {
        var document = await _coordinatorAdminService.GetCoordinatorIdentityDocumentAsync(userId, cancellationToken);
        return await Infrastructure.StoredDocumentResult.ServeAsync(document, cancellationToken);
    }
}
