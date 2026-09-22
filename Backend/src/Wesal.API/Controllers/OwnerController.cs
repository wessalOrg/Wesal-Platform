using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;

namespace Wesal.API.Controllers;

/// <summary>
/// Hall Owner management interface (Epic 8: US-OWNER-01, US-OWNER-03). The
/// RequireHallOwner policy provides role-based routing: only Hall Owners reach
/// these endpoints, so a Regular User tapping the Profile icon keeps the simple
/// profile panel.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/owner")]
[Authorize(Policy = ApplicationPolicies.RequireHallOwner)]
public class OwnerController : ControllerBase
{
    private readonly IOwnerSidebarService _sidebarService;
    private readonly IHallCreationService _hallCreationService;
    private readonly IHallInitiationService _hallInitiationService;
    private readonly IHallStatusTrackingService _hallStatusTrackingService;
    private readonly IOwnerHallService _ownerHallService;
    private readonly IOwnerBookingRequestsService _ownerBookingRequestsService;
    private readonly IOwnerAvailabilityService _ownerAvailabilityService;
    private readonly IHallSubscriptionService _hallSubscriptionService;
    private readonly IOwnerIdentityService _ownerIdentityService;
    private readonly IPaymentReceiptService _paymentReceiptService;

    public OwnerController(
        IOwnerSidebarService sidebarService,
        IHallCreationService hallCreationService,
        IHallInitiationService hallInitiationService,
        IHallStatusTrackingService hallStatusTrackingService,
        IOwnerHallService ownerHallService,
        IOwnerBookingRequestsService ownerBookingRequestsService,
        IOwnerAvailabilityService ownerAvailabilityService,
        IHallSubscriptionService hallSubscriptionService,
        IOwnerIdentityService ownerIdentityService,
        IPaymentReceiptService paymentReceiptService)
    {
        _sidebarService = sidebarService;
        _hallCreationService = hallCreationService;
        _hallInitiationService = hallInitiationService;
        _hallStatusTrackingService = hallStatusTrackingService;
        _ownerHallService = ownerHallService;
        _ownerBookingRequestsService = ownerBookingRequestsService;
        _ownerAvailabilityService = ownerAvailabilityService;
        _hallSubscriptionService = hallSubscriptionService;
        _ownerIdentityService = ownerIdentityService;
        _paymentReceiptService = paymentReceiptService;
    }

    /// <summary>
    /// Returns the sidebar data for the Hall Owner management interface.
    /// The 'Profile' section is first and open by default; its content is loaded
    /// through the profile API rather than embedded here, so the Profile section
    /// remains accessible even if this management data fails to load.
    /// </summary>
    [HttpGet("sidebar")]
    [ProducesResponseType(typeof(OwnerSidebarResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<OwnerSidebarResponse>> GetSidebar(CancellationToken cancellationToken)
    {
        var response = await _sidebarService.GetSidebarAsync(cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Starts the 'Add Hall' flow (US-OWNER-03). Tapping the Add Hall button calls
    /// this endpoint before opening the Add Hall form (US-OWNER-04). It verifies a
    /// live, authenticated Hall Owner session and returns a machine-readable 'Ready'
    /// response; it never creates an empty or invalid hall record. Blocked states
    /// surface as HTTP problem details: 401 (unauthenticated/expired session), 403
    /// (not a Hall Owner) and 404 (session points to a deleted account).
    /// </summary>
    [HttpPost("halls/initiate")]
    [ProducesResponseType(typeof(HallInitiationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<HallInitiationResponse>> InitiateAddHall(CancellationToken cancellationToken)
    {
        var response = await _hallInitiationService.InitiateAsync(cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Returns the authenticated Hall Owner's own halls with their current approval
    /// status (US-OWNER-05). The owner is resolved exclusively from the authenticated
    /// session and only that owner's halls are returned, so an owner can never read
    /// another owner's halls. Status is read live from the persisted record on every
    /// request, so the owner always sees the current PendingReview/Approved/Rejected
    /// state even when an Admin approved or rejected the hall in another session.
    /// </summary>
    [HttpGet("halls")]
    [ProducesResponseType(typeof(IReadOnlyList<OwnerHallDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<OwnerHallDto>>> GetOwnedHalls(CancellationToken cancellationToken)
    {
        var halls = await _hallStatusTrackingService.GetOwnedHallsAsync(cancellationToken);
        return Ok(halls);
    }

    /// <summary>
    /// Returns the authenticated Hall Owner's hall with its full editable details
    /// (US-OWNER-07): contact phone, region, address, description, capacity, price,
    /// photos and the two daily booking periods, together with its current approval
    /// status and a server-computed editability flag. The owner is resolved exclusively
    /// from the authenticated session, so an owner can never read another owner's hall.
    /// </summary>
    [HttpGet("halls/{hallId:guid}")]
    [ProducesResponseType(typeof(OwnerHallDetailsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OwnerHallDetailsDto>> GetOwnedHallDetails(
        Guid hallId,
        CancellationToken cancellationToken)
    {
        var details = await _ownerHallService.GetOwnedHallDetailsAsync(hallId, cancellationToken);
        return Ok(details);
    }

    /// <summary>
    /// Updates the authenticated Hall Owner's hall details (US-OWNER-07, FR-HALL-02).
    /// Changes to an already-approved hall are applied atomically and take effect
    /// immediately without re-triggering the Admin approval workflow; the hall's
    /// approval status and owner identity are preserved server-side and are never taken
    /// from the request. Editing is rejected while the hall is under Admin review
    /// (PendingReview), surfacing a clear locked/pending message instead of applying
    /// changes.
    /// </summary>
    [HttpPut("halls/{hallId:guid}")]
    [ProducesResponseType(typeof(OwnerHallDetailsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ActionResult<OwnerHallDetailsDto>> UpdateOwnedHall(
        Guid hallId,
        [FromBody] UpdateOwnerHallRequest request,
        CancellationToken cancellationToken)
    {
        var details = await _ownerHallService.UpdateOwnedHallAsync(hallId, request, cancellationToken);
        return Ok(details);
    }

    /// <summary>
    /// Returns the incoming (pending) booking requests for the authenticated Hall
    /// Owner's own hall (US-OWNER-09, FR-BOOK-01). Each entry shows the request id,
    /// the requested date, its requested booking period, and the display name of the
    /// Regular User who submitted it. The owner is resolved exclusively from the
    /// authenticated session and the requester name is resolved server-side, so the
    /// client can never read another owner's hall or impersonate a requester. All
    /// pending requests are returned without deduplication: competing requests for the
    /// same hall/date/period each appear, and a request covering both daily periods
    /// appears as one entry per period. This endpoint is read-only and never changes a
    /// booking's status, availability, or reservation.
    /// </summary>
    [HttpGet("halls/{hallId:guid}/bookings")]
    [ProducesResponseType(typeof(IReadOnlyList<OwnerBookingRequestDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<IReadOnlyList<OwnerBookingRequestDto>>> GetOwnedHallBookingRequests(
        Guid hallId,
        CancellationToken cancellationToken)
    {
        var requests = await _ownerBookingRequestsService.GetBookingRequestsAsync(hallId, cancellationToken);
        return Ok(requests);
    }

    /// <summary>
    /// Soft-deletes the authenticated Hall Owner's own hall (US-OWNER-16).
    /// Historical bookings/messages/conversations are preserved; the hall is
    /// removed from public visibility and new bookings are rejected.
    /// Repeated deletion returns NotFound.
    /// </summary>
    [HttpDelete("halls/{hallId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteOwnedHall(
        Guid hallId,
        CancellationToken cancellationToken)
    {
        await _ownerHallService.DeleteOwnedHallAsync(hallId, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Returns the current subscription status of the authenticated Hall Owner's own
    /// hall (US-OWNER-17, FR-HALL-05): Active when the hall's 30-day paid cycle is
    /// running, Payment Pending when the hall is under review or approved but unpaid,
    /// Expired when the paid cycle ended without renewal, and Locked when an Admin
    /// manually locked it. The next billing date is included whenever the hall has a
    /// paid cycle. The owner is resolved exclusively from the authenticated session
    /// and the status is computed live from the persisted record on every request.
    /// This endpoint is read-only and never changes payment, approval or lock state.
    /// </summary>
    [HttpGet("halls/{hallId:guid}/subscription")]
    [ProducesResponseType(typeof(OwnerHallSubscriptionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OwnerHallSubscriptionDto>> GetOwnedHallSubscription(
        Guid hallId,
        CancellationToken cancellationToken)
    {
        var subscription = await _hallSubscriptionService.GetHallSubscriptionAsync(hallId, cancellationToken);
        return Ok(subscription);
    }

    /// <summary>
    /// Returns the availability calendar for the authenticated Hall Owner's own
    /// hall (US-OWNER-18). Both predefined daily booking periods are returned
    /// independently per day. Ownership is resolved server-side.
    /// </summary>
    [HttpGet("halls/{hallId:guid}/availability")]
    [ProducesResponseType(typeof(OwnerAvailabilityCalendarDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OwnerAvailabilityCalendarDto>> GetOwnedHallAvailability(
        Guid hallId,
        [FromQuery] DateOnly fromDate,
        [FromQuery] DateOnly toDate,
        CancellationToken cancellationToken)
    {
        var response = await _ownerAvailabilityService.GetAvailabilityAsync(hallId, fromDate, toDate, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Updates an individual booking period's availability for the authenticated
    /// Hall Owner's own hall (US-OWNER-18). Periods are independent; only the
    /// requested period is modified. Genuinely reserved periods cannot be released.
    /// </summary>
    [HttpPut("halls/{hallId:guid}/availability")]
    [ProducesResponseType(typeof(OwnerAvailabilityPeriodDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<OwnerAvailabilityPeriodDto>> UpdateOwnedHallAvailability(
        Guid hallId,
        [FromBody] UpdateOwnerAvailabilityRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _ownerAvailabilityService.UpdateAvailabilityAsync(hallId, request, cancellationToken);
        return Ok(response);
    }

    [HttpPost("halls")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(CreateHallResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<CreateHallResponse>> CreateHall(
        [FromForm] string Name,
        [FromForm] string ContactPhone,
        [FromForm] string Region,
        [FromForm] string Address,
        [FromForm] string? DetailedAddress,
        [FromForm] string? Description,
        [FromForm] int Capacity,
        [FromForm] decimal? Price,
        [FromForm] string? YouTubeVideoUrl,
        [FromForm] string? Features,
        [FromForm] string? OtherFeatures,
        [FromForm] TimeOnly FirstPeriodStart,
        [FromForm] TimeOnly FirstPeriodEnd,
        [FromForm] TimeOnly SecondPeriodStart,
        [FromForm] TimeOnly SecondPeriodEnd,
        [FromForm] IFormFile? MainPhoto,
        [FromForm] IFormFile[]? Photos,
        CancellationToken cancellationToken)
    {
        var photoUploads = Photos == null ? null : await Task.WhenAll(Photos.Select(async p =>
        {
            using var ms = new MemoryStream();
            await p.CopyToAsync(ms, cancellationToken);
            return new HallPhotoUpload { FileName = p.FileName, ContentType = p.ContentType, Content = ms.ToArray() };
        }));

        HallPhotoUpload? mainPhotoUpload = null;
        if (MainPhoto is not null)
        {
            using var mainStream = new MemoryStream();
            await MainPhoto.CopyToAsync(mainStream, cancellationToken);
            mainPhotoUpload = new HallPhotoUpload { FileName = MainPhoto.FileName, ContentType = MainPhoto.ContentType, Content = mainStream.ToArray() };
        }

        var request = new CreateHallRequest
        {
            Name = Name,
            ContactPhone = ContactPhone,
            Region = Region,
            Address = Address,
            DetailedAddress = DetailedAddress,
            Description = Description,
            Capacity = Capacity,
            Price = Price,
            YouTubeVideoUrl = YouTubeVideoUrl,
            Features = SplitFeatures(Features),
            OtherFeatures = OtherFeatures,
            FirstPeriodStart = FirstPeriodStart,
            FirstPeriodEnd = FirstPeriodEnd,
            SecondPeriodStart = SecondPeriodStart,
            SecondPeriodEnd = SecondPeriodEnd,
            MainPhoto = mainPhotoUpload,
            Photos = photoUploads
        };

        var response = await _hallCreationService.CreateHallAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetSidebar), response);
    }

    private static IReadOnlyList<string>? SplitFeatures(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        // Features arrive as a JSON serialized string[] from the multipart form
        // (the frontend posts them as a single field). Tolerate plain comma lists too.
        var trimmed = raw.Trim();
        if (trimmed.StartsWith("[", StringComparison.Ordinal) && trimmed.EndsWith("]", StringComparison.Ordinal))
        {
            try
            {
                var parsed = System.Text.Json.JsonSerializer.Deserialize<string[]>(trimmed);
                return parsed is null ? null : parsed.ToList();
            }
            catch (System.Text.Json.JsonException)
            {
                // Fall through to comma-splitting below.
            }
        }

        return trimmed.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
    }

    /// <summary>
    /// Uploads the authenticated Hall Owner's identity document (US-OWNER-30). The
    /// document is mandatory before the owner can create a hall and is stored outside
    /// the public media area; only the owner and the Admin can read it.
    /// </summary>
    [HttpPost("profile/identity-document")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(IdentityDocumentUploadResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IdentityDocumentUploadResult>> UploadIdentityDocument(
        [FromForm] IFormFile file,
        CancellationToken cancellationToken)
    {
        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, cancellationToken);

        var upload = new OwnerDocumentUpload
        {
            FileName = file.FileName,
            ContentType = file.ContentType,
            Content = ms.ToArray()
        };

        var result = await _ownerIdentityService.UploadIdentityDocumentAsync(upload, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Streams the authenticated Hall Owner's own identity document (US-OWNER-30).
    /// Only the owner (and the Admin) can read it; the response is not public.
    /// </summary>
    [HttpGet("profile/identity-document")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetIdentityDocument(CancellationToken cancellationToken)
    {
        var document = await _ownerIdentityService.GetIdentityDocumentAsync(cancellationToken);
        return PhysicalFile(document.FullPath, document.ContentType);
    }

    /// <summary>
    /// Uploads the payment receipt for one of the authenticated Hall Owner's own halls
    /// (US-OWNER-31). Only valid for an Approved, not-yet-paid hall; the hall moves to
    /// ReceiptUploaded and stays private until the Admin confirms the payment.
    /// </summary>
    [HttpPost("halls/{hallId:guid}/payment-receipt")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(PaymentReceiptUploadResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<PaymentReceiptUploadResult>> UploadPaymentReceipt(
        Guid hallId,
        [FromForm] IFormFile file,
        CancellationToken cancellationToken)
    {
        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, cancellationToken);

        var upload = new OwnerDocumentUpload
        {
            FileName = file.FileName,
            ContentType = file.ContentType,
            Content = ms.ToArray()
        };

        var result = await _paymentReceiptService.UploadPaymentReceiptAsync(hallId, upload, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Streams the payment receipt of one of the authenticated Hall Owner's own halls
    /// (US-OWNER-31). Only the owner (and the Admin) can read it.
    /// </summary>
    [HttpGet("halls/{hallId:guid}/payment-receipt")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPaymentReceipt(Guid hallId, CancellationToken cancellationToken)
    {
        var document = await _paymentReceiptService.GetPaymentReceiptAsync(hallId, cancellationToken);
        return PhysicalFile(document.FullPath, document.ContentType);
    }
}