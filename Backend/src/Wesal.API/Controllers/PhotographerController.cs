using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

/// <summary>
/// Photographer account setup (WESAL photographer setup).
///
/// After registering as a Photographer, the account is not complete until the setup
/// data is submitted here. The submission always applies to the authenticated caller's
/// own account — there is no user-id parameter, so one photographer can never submit
/// setup data for another account. Responses carry only minimal status information;
/// the administrator-only full name and private document URLs/keys are never returned.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/photographer")]
[Authorize(Policy = ApplicationPolicies.RequirePhotographer)]
public class PhotographerController : ControllerBase
{
    private readonly IPhotographerSetupService _photographerSetupService;

    public PhotographerController(IPhotographerSetupService photographerSetupService)
    {
        _photographerSetupService = photographerSetupService;
    }

    /// <summary>
    /// Submits the photographer's setup data. The mandatory <c>HasStudio</c> answer
    /// selects the required branch: studio — studio name, studio location, detailed
    /// studio location, studio phone, personal ID document; no studio — full name
    /// (administrator-only), phone, personal ID document. On success the account
    /// becomes setup-complete and its approval status becomes Pending.
    /// </summary>
    [HttpPost("setup")]
    [Consumes("multipart/form-data")]
    // Envelope derived from the real contract: a single 5 MB ID document plus the
    // short text fields and multipart framing overhead.
    [RequestSizeLimit(Infrastructure.UploadLimits.PhotographerFormRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = Infrastructure.UploadLimits.PhotographerFormRequestBytes)]
    [ProducesResponseType(typeof(PhotographerSetupResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<PhotographerSetupResult>> SubmitSetup(
        [FromForm] bool? HasStudio,
        [FromForm] string? StudioName,
        [FromForm] string? StudioLocation,
        [FromForm] string? DetailedStudioLocation,
        [FromForm] string? FullName,
        [FromForm] string? PhoneNumber,
        IFormFile? IdentityDocument,
        CancellationToken cancellationToken)
    {
        var identityDocumentUpload = await BufferFileAsync(IdentityDocument, cancellationToken);

        var submission = new PhotographerSetupSubmission
        {
            Form = new PhotographerSetupRequest
            {
                HasStudio = HasStudio,
                StudioName = StudioName,
                StudioLocation = StudioLocation,
                DetailedStudioLocation = DetailedStudioLocation,
                FullName = FullName,
                PhoneNumber = PhoneNumber
            },
            IdentityDocument = identityDocumentUpload
        };

        var result = await _photographerSetupService.SubmitSetupAsync(submission, cancellationToken);
        return Ok(result);
    }

    private static async Task<OwnerDocumentUpload?> BufferFileAsync(IFormFile? file, CancellationToken cancellationToken)
    {
        if (file is null)
        {
            return null;
        }

        // Presence/size are checked against the declared length before any bytes are
        // copied; type/MIME/signature validation happens in the setup service.
        if (file.Length == 0)
        {
            throw new Wesal.Domain.Exceptions.ValidationException(
                new Dictionary<string, string[]> { ["Files"] = new[] { "An attached file is empty." } });
        }

        Infrastructure.UploadedFileGuard.ThrowIfTooLarge(
            file, "Files", "File size must not exceed 5MB.");

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, cancellationToken);
        return new OwnerDocumentUpload
        {
            FileName = file.FileName,
            ContentType = file.ContentType,
            Content = ms.ToArray()
        };
    }
}
