using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Enums;

namespace Wesal.API.Controllers;

/// <summary>
/// Event Coordinator account setup (WESAL coordinator setup).
///
/// After registering as an Event Coordinator, the account is not complete until the
/// setup data is submitted here. The submission always applies to the authenticated
/// caller's own account — there is no user-id parameter, so one coordinator can never
/// submit setup data for another account. Responses carry only minimal status
/// information; private document URLs and storage keys are never returned.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/coordinator")]
[Authorize(Policy = ApplicationPolicies.RequireEventCoordinator)]
public class CoordinatorController : ControllerBase
{
    private readonly ICoordinatorSetupService _coordinatorSetupService;

    public CoordinatorController(ICoordinatorSetupService coordinatorSetupService)
    {
        _coordinatorSetupService = coordinatorSetupService;
    }

    /// <summary>
    /// Submits the coordinator's setup data. The mandatory shop-vs-freelance
    /// <c>BusinessType</c> selects the required branch:
    /// Shop — shop name, phone, shop location, shop photo, personal ID document;
    /// Freelance — online store name, phone, exactly two work photos, personal ID
    /// document. On success the account becomes setup-complete and its approval status
    /// becomes Pending.
    /// </summary>
    [HttpPost("setup")]
    [Consumes("multipart/form-data")]
    // Envelope derived from the real contract: the freelance branch carries the most
    // files (2 work photos + 1 ID document) at 5 MB each plus framing overhead.
    [RequestSizeLimit(Infrastructure.UploadLimits.CoordinatorFormRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = Infrastructure.UploadLimits.CoordinatorFormRequestBytes)]
    [ProducesResponseType(typeof(CoordinatorSetupResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CoordinatorSetupResult>> SubmitSetup(
        [FromForm] CoordinatorBusinessType? BusinessType,
        [FromForm] string? ShopName,
        [FromForm] string? ShopLocation,
        [FromForm] string? OnlineStoreName,
        [FromForm] string? PhoneNumber,
        IFormFile? ShopPhoto,
        IFormFile[]? WorkPhotos,
        IFormFile? IdentityDocument,
        CancellationToken cancellationToken)
    {
        var shopPhotoUpload = await BufferFileAsync(ShopPhoto, cancellationToken);

        var workPhotoUploads = new List<OwnerDocumentUpload>();
        if (WorkPhotos is not null)
        {
            foreach (var workPhoto in WorkPhotos)
            {
                // Declared length is known from the multipart framing: reject
                // oversized files here instead of buffering them first.
                Infrastructure.UploadedFileGuard.ThrowIfTooLarge(
                    workPhoto, "WorkPhotos", "Photo size must not exceed 5MB.");
                workPhotoUploads.Add((await BufferFileAsync(workPhoto, cancellationToken))!);
            }
        }

        var identityDocumentUpload = await BufferFileAsync(IdentityDocument, cancellationToken);

        var submission = new CoordinatorSetupSubmission
        {
            Form = new CoordinatorSetupRequest
            {
                BusinessType = BusinessType,
                ShopName = ShopName,
                ShopLocation = ShopLocation,
                OnlineStoreName = OnlineStoreName,
                PhoneNumber = PhoneNumber
            },
            ShopPhoto = shopPhotoUpload,
            WorkPhotos = workPhotoUploads,
            IdentityDocument = identityDocumentUpload
        };

        var result = await _coordinatorSetupService.SubmitSetupAsync(submission, cancellationToken);
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

    /// <summary>
    /// Resubmits the coordinator setup after rejection. Only allowed when current approval status is Rejected.
    /// Re-runs the same validators and attachment rules; updates the existing profile and resets status to Pending.
    /// </summary>
    [HttpPut("setup/resubmit")]
    [HttpPost("setup/resubmit")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(Infrastructure.UploadLimits.CoordinatorFormRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = Infrastructure.UploadLimits.CoordinatorFormRequestBytes)]
    [ProducesResponseType(typeof(CoordinatorSetupResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CoordinatorSetupResult>> ResubmitSetup(
        [FromForm] CoordinatorBusinessType? BusinessType,
        [FromForm] string? ShopName,
        [FromForm] string? ShopLocation,
        [FromForm] string? OnlineStoreName,
        [FromForm] string? PhoneNumber,
        IFormFile? ShopPhoto,
        IFormFile[]? WorkPhotos,
        IFormFile? IdentityDocument,
        CancellationToken cancellationToken)
    {
        var shopPhotoUpload = await BufferFileAsync(ShopPhoto, cancellationToken);

        var workPhotoUploads = new List<OwnerDocumentUpload>();
        if (WorkPhotos is not null)
        {
            foreach (var workPhoto in WorkPhotos)
            {
                Infrastructure.UploadedFileGuard.ThrowIfTooLarge(
                    workPhoto, "WorkPhotos", "Photo size must not exceed 5MB.");
                workPhotoUploads.Add((await BufferFileAsync(workPhoto, cancellationToken))!);
            }
        }

        var identityDocumentUpload = await BufferFileAsync(IdentityDocument, cancellationToken);

        var submission = new CoordinatorSetupSubmission
        {
            Form = new CoordinatorSetupRequest
            {
                BusinessType = BusinessType,
                ShopName = ShopName,
                ShopLocation = ShopLocation,
                OnlineStoreName = OnlineStoreName,
                PhoneNumber = PhoneNumber
            },
            ShopPhoto = shopPhotoUpload,
            WorkPhotos = workPhotoUploads,
            IdentityDocument = identityDocumentUpload
        };

        var result = await _coordinatorSetupService.ResubmitSetupAsync(submission, cancellationToken);
        return Ok(result);
    }
}
