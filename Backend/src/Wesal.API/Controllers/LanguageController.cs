using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/language")]
public class LanguageController : ControllerBase
{
    private readonly ILanguageService _languageService;

    public LanguageController(ILanguageService languageService)
    {
        _languageService = languageService;
    }

    /// <summary>
    /// Retrieves the authenticated user's language preference.
    /// </summary>
    /// <remarks>
    /// Supported language codes: ar (Arabic), en (English).
    /// Users without an explicitly stored preference resolve to Arabic (ar).
    /// </remarks>
    [HttpGet]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(LanguageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<LanguageResponse>> GetLanguage(CancellationToken cancellationToken)
    {
        var response = await _languageService.GetLanguageAsync(cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Updates the authenticated user's language preference.
    /// </summary>
    /// <remarks>
    /// Request body:
    /// {
    ///   "language": "ar"
    /// }
    /// Supported language codes: ar (Arabic), en (English).
    /// Unsupported codes are rejected with a 400 (Validation Error) response.
    /// </remarks>
    [HttpPut]
    [Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
    [ProducesResponseType(typeof(LanguageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<LanguageResponse>> UpdateLanguage(
        [FromBody] UpdateLanguageRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _languageService.UpdateLanguageAsync(request, cancellationToken);
        return Ok(response);
    }
}