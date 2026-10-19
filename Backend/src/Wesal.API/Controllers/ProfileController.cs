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
    private readonly IProfessionalProfileService _professionalProfileService;

    public ProfileController(IProfileService profileService, IProfessionalProfileService professionalProfileService)
    {
        _profileService = profileService;
        _professionalProfileService = professionalProfileService;
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

    [HttpPost("change-password")]
    [ProducesResponseType(typeof(ChangePasswordResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ChangePasswordResponse>> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        var response = await _profileService.ChangePasswordAsync(request, cancellationToken);
        return Ok(response);
    }

    [HttpGet("{userId}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PublicProfessionalProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PublicProfessionalProfileResponse>> GetPublicProfile(string userId, CancellationToken cancellationToken)
        => Ok(await _professionalProfileService.GetPublicProfileAsync(userId, cancellationToken));

    [HttpPut("bio")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdatePublicBio([FromBody] UpdatePublicBioRequest request, CancellationToken cancellationToken)
    {
        await _professionalProfileService.UpdateBioAsync(request, cancellationToken);
        return NoContent();
    }

    [HttpPost("picture")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(Infrastructure.UploadLimits.SingleFileRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = Infrastructure.UploadLimits.SingleFileRequestBytes)]
    [ProducesResponseType(typeof(string), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<string>> UploadProfilePicture(IFormFile file, CancellationToken cancellationToken)
    {
        Infrastructure.UploadedFileGuard.EnsureAttachmentImage(file);
        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, cancellationToken);
        var url = await _professionalProfileService.UploadProfilePictureAsync(new OwnerDocumentUpload
        {
            FileName = file.FileName,
            ContentType = file.ContentType,
            Content = buffer.ToArray()
        }, cancellationToken);
        return Ok(url);
    }

    [HttpGet("{userId}/picture")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProfilePicture(string userId, CancellationToken cancellationToken)
    {
        var image = await _professionalProfileService.GetProfilePictureAsync(userId, cancellationToken);
        Response.Headers.CacheControl = "no-store";
        return File(image.Content ?? [], image.ContentType);
    }
}
