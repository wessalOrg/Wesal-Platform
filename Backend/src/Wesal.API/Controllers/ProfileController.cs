using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/profile")]
[Authorize(Policy = ApplicationPolicies.RequireAuthenticatedUser)]
public class ProfileController : ControllerBase
{
    private readonly IProfileService _profileService;

    public ProfileController(IProfileService profileService)
    {
        _profileService = profileService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(ProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ProfileResponse>> GetProfile(CancellationToken cancellationToken)
    {
        var response = await _profileService.GetProfileAsync(cancellationToken);
        return Ok(response);
    }

    [HttpPut]
    [ProducesResponseType(typeof(ProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ProfileResponse>> UpdateProfile([FromBody] UpdateProfileRequest request, CancellationToken cancellationToken)
    {
        var response = await _profileService.UpdateProfileAsync(request, cancellationToken);
        return Ok(response);
    }
}
