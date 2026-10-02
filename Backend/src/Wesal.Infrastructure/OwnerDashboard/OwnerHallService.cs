using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Catalogs;
using Wesal.Domain.Common;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Halls;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.OwnerDashboard;

/// <summary>
/// Retrieves and updates a hall owned by the authenticated Hall Owner (US-OWNER-07,
/// FR-HALL-02). The owner is resolved exclusively from the authenticated session;
/// ownership is enforced by the repository so a caller can never read or update
/// another owner's hall. Management access is gated by <see cref="HallManagementAccess"/>
/// (US-ADMIN-05/07/09) on payment and lock state — deliberately not on approval status:
/// an owner may edit their hall at any time, whether it is PendingReview, Approved, or
/// Rejected, so the Admin always reviews exactly what is currently stored. The update
/// is applied atomically in a single transaction and never touches the hall's approval
/// status or owner identity — except for the resubmission rule (FR-ADM-01): editing a
/// Rejected hall re-queues it to PendingReview.
/// </summary>
public sealed class OwnerHallService : IOwnerHallService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ICurrentUserService _currentUser;
    private readonly IOwnerDashboardRepository _ownerDashboardRepository;
    private readonly IBookingRepository _bookingRepository;
    private readonly IHallMediaStorage _mediaStorage;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<OwnerHallService> _logger;

    public OwnerHallService(
        UserManager<ApplicationUser> userManager,
        ICurrentUserService currentUser,
        IOwnerDashboardRepository ownerDashboardRepository,
        IBookingRepository bookingRepository,
        IHallMediaStorage mediaStorage,
        IUnitOfWork unitOfWork,
        ILogger<OwnerHallService> logger)
    {
        _userManager = userManager;
        _currentUser = currentUser;
        _ownerDashboardRepository = ownerDashboardRepository;
        _bookingRepository = bookingRepository;
        _mediaStorage = mediaStorage;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<OwnerHallDetailsDto> GetOwnedHallDetailsAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var ownerId = await ResolveOwnerAsync(cancellationToken);

        var hall = await _ownerDashboardRepository.GetOwnedHallWithDetailsAsync(hallId, ownerId, cancellationToken);

        if (hall is null)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        // Edit 16: a locked/suspended hall refuses owner access too, with the same
        // central unavailable message used for bookings and messages.
        HallManagementAccess.EnsureDataEditable(hall);

        return MapToDetails(hall);
    }

    public async Task<OwnerHallDetailsDto> UpdateOwnedHallAsync(
        Guid hallId,
        UpdateOwnerHallRequest request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var ownerId = await ResolveOwnerAsync(cancellationToken);

        var hall = await _ownerDashboardRepository.GetOwnedHallForUpdateAsync(hallId, ownerId, cancellationToken);

        if (hall is null)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        // WESAL-TASK-2+3 (Edit 3): the owner may edit their hall's own data at any time and
        // at any approval status. Only the two authoritative holds still refuse the edit; the
        // payment requirement is not one of them. Booking, availability and subscription
        // actions keep calling HallManagementAccess.EnsureAllowed and stay payment-gated.
        HallManagementAccess.EnsureDataEditable(hall);

        // Edit 24: newly uploaded files are persisted and merged into the request BEFORE
        // any validation runs, so a save that replaces every existing photo with fresh
        // uploads validates against the real (merged) gallery instead of failing the
        // "at least one photo" rule on the URL-only payload.
        var (effectiveRequest, savedPaths) = await MergeUploadedPhotosAsync(hall.Id, request, cancellationToken);

        try
        {
            EnsureValidMergedGallery(request, effectiveRequest);

            // The hall-details update carries the same bookable-window fields as the
            // dedicated hourly-settings endpoint, so it enforces the same rules: the
            // *effective* window (request merged over persisted values) must be ordered
            // whole hours, and narrowing it past a live booking is refused with the same
            // ConflictException the hourly-settings path uses, so this endpoint can never
            // strand an active booking by reshaping the window around it.
            await EnsureWindowChangeAllowedAsync(hall, effectiveRequest, cancellationToken);

            await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                ApplyHallDetails(hall, effectiveRequest);

                // Resubmission (FR-ADM-01, US-ADMIN-03): editing a Rejected hall re-queues
                // it for review. Editing an Approved or PendingReview hall never changes
                // its approval state.
                if (hall.Status == HallStatus.Rejected)
                {
                    hall.Status = HallStatus.PendingReview;
                }

                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }, cancellationToken);
        }
        catch
        {
            // A refused write must not orphan freshly saved uploads: compensate
            // exactly the objects this request created (never history), logging
            // cleanup failures without masking the original exception.
            foreach (var stored in savedPaths)
            {
                try
                {
                    await _mediaStorage.DeleteAsync(stored, CancellationToken.None);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to clean up hall media {StorageKey} after a failed update", stored.StorageKey);
                }
            }

            throw;
        }

        return MapToDetails(hall);
    }

    public async Task DeleteOwnedHallAsync(
        Guid hallId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var ownerId = await ResolveOwnerAsync(cancellationToken);

        var hall = await _ownerDashboardRepository.GetOwnedHallForUpdateAsync(hallId, ownerId, cancellationToken);

        if (hall is null)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        // Deletion is allowed regardless of payment status, admin lock, or system
        // lock — the owner can always remove their own hall. Ownership is already
        // enforced by the repository (GetOwnedHallForUpdateAsync scopes to ownerId).

        hall.IsDeleted = true;
        hall.UpdatedAt = DateTimeOffset.UtcNow;

        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }, cancellationToken);
    }

    private async Task<string> ResolveOwnerAsync(CancellationToken cancellationToken)
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to manage your hall.");
        }

        // Validate the account still exists; a token for a deleted account is not a valid owner session.
        var user = await _userManager.FindByIdAsync(_currentUser.UserId);
        if (user is null)
        {
            throw new NotFoundException("User", _currentUser.UserId);
        }

        return _currentUser.UserId;
    }

    /// <summary>
    /// Persists newly uploaded photos and merges them into an effective request
    /// (Edit 24): an uploaded cover wins <see cref="UpdateOwnerHallRequest.MainImageUrl"/>
    /// and uploaded gallery files are appended to <see cref="UpdateOwnerHallRequest.Photos"/>
    /// with continuing display order. Returns the request unchanged when no uploads
    /// accompany it (pure JSON path).
    /// </summary>
    private async Task<(UpdateOwnerHallRequest Effective, List<StoredHallMedia> SavedPaths)> MergeUploadedPhotosAsync(
        Guid hallId,
        UpdateOwnerHallRequest request,
        CancellationToken cancellationToken)
    {
        var savedPaths = new List<StoredHallMedia>();

        var hasCoverUpload = request.MainPhoto is not null && request.MainPhoto.Content.Length > 0;
        var galleryUploads = request.NewPhotos
            ?.Where(upload => upload is not null)
            .ToList() ?? [];

        if (!hasCoverUpload && galleryUploads.Count == 0)
        {
            return (request, savedPaths);
        }

        string? uploadedCoverUrl = null;
        if (hasCoverUpload)
        {
            HallPhotoUploadValidator.EnsureValidImage(request.MainPhoto!, "MainPhoto");
            uploadedCoverUrl = await SaveUploadedPhotoAsync(hallId, request.MainPhoto!, savedPaths, cancellationToken);
        }

        var mergedPhotos = request.Photos.ToList();
        var nextOrder = mergedPhotos.Count == 0
            ? 0
            : mergedPhotos.Max(photo => photo.DisplayOrder) + 1;
        foreach (var upload in galleryUploads)
        {
            HallPhotoUploadValidator.EnsureValidImage(upload, "Photos");
            var url = await SaveUploadedPhotoAsync(hallId, upload, savedPaths, cancellationToken);
            mergedPhotos.Add(new UpdateOwnerHallPhotoDto { Url = url, DisplayOrder = nextOrder++ });
        }

        return (new UpdateOwnerHallRequest
        {
            Name = request.Name,
            MainImageUrl = uploadedCoverUrl ?? request.MainImageUrl,
            ContactPhone = request.ContactPhone,
            Region = request.Region,
            Address = request.Address,
            DetailedAddress = request.DetailedAddress,
            Description = request.Description,
            Capacity = request.Capacity,
            Price = request.Price,
            ShowPrice = request.ShowPrice,
            YouTubeVideoUrl = request.YouTubeVideoUrl,
            Features = request.Features,
            OtherFeatures = request.OtherFeatures,
            Photos = mergedPhotos,
            HourlySlotStart = request.HourlySlotStart,
            HourlySlotEnd = request.HourlySlotEnd,
            MainPhoto = request.MainPhoto,
            NewPhotos = request.NewPhotos
        }, savedPaths);
    }

    private async Task<string> SaveUploadedPhotoAsync(
        Guid hallId,
        HallPhotoUpload upload,
        List<StoredHallMedia> savedPaths,
        CancellationToken cancellationToken)
    {
        var stored = await _mediaStorage.SaveAsync(hallId, upload, cancellationToken);
        savedPaths.Add(stored);

        return stored.PublicUrl;
    }

    /// <summary>
    /// Validates the merged gallery, and only when the request carries uploads
    /// (Edit 24). The remaining field rules stay where they belong — the Fluent
    /// validator at the API boundary (which sees the same payload on both content-type
    /// paths) and the service's own nuanced guards below. A blanket re-validation here
    /// would wrongly reject unchanged legacy addresses (which <see cref="ApplyAddress"/>
    /// deliberately tolerates) and would mask the <c>AddressNotInRegion</c> business
    /// rule with a generic validation error; and a gallery rule on upload-free calls
    /// would reject the minimal payloads the pre-existing service contract accepts.
    /// Failures surface as <see cref="ValidationException"/> (400) with the same
    /// messages the boundary validator uses.
    /// </summary>
    private static void EnsureValidMergedGallery(
        UpdateOwnerHallRequest request,
        UpdateOwnerHallRequest effectiveRequest)
    {
        var suppliedUploads = request.MainPhoto is not null
            || (request.NewPhotos?.Count ?? 0) > 0;

        if (!suppliedUploads)
        {
            return;
        }

        if (effectiveRequest.Photos.Count == 0)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Photos"] = ["At least one photo is required."]
            });
        }

        if (effectiveRequest.Photos.Select(photo => photo.DisplayOrder).Distinct().Count()
            != effectiveRequest.Photos.Count)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Photos"] = ["Photo display orders must not contain duplicates."]
            });
        }
    }

    private async Task EnsureWindowChangeAllowedAsync(
        Hall hall,
        UpdateOwnerHallRequest request,
        CancellationToken cancellationToken)
    {
        var windowChanged = (request.HourlySlotStart.HasValue && request.HourlySlotStart.Value != hall.HourlySlotStart)
            || (request.HourlySlotEnd.HasValue && request.HourlySlotEnd.Value != hall.HourlySlotEnd);

        if (!windowChanged)
        {
            return;
        }

        var effectiveStart = request.HourlySlotStart ?? hall.HourlySlotStart;
        var effectiveEnd = request.HourlySlotEnd ?? hall.HourlySlotEnd;

        // A null side means "no configured bound", which the seeker catalog resolves
        // to the 09:00/22:00 defaults, so only a fully-specified effective window is
        // ordered here; the FluentValidation rules already pin whole-hour values.
        if (effectiveStart.HasValue && effectiveEnd.HasValue && effectiveStart.Value >= effectiveEnd.Value)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["HourlySlotEnd"] = ["HourlySlotEnd must be after HourlySlotStart."]
            });
        }

        var windowStart = effectiveStart ?? HallBookingWindow.DefaultStart;
        var windowEnd = effectiveEnd ?? HallBookingWindow.DefaultEnd;

        if (await _bookingRepository.HasActiveHourlyBookingsOutsideWindowAsync(
            hall.Id, windowStart, windowEnd, cancellationToken))
        {
            throw new ConflictException(
                $"The new bookable window would hide an hour that already has an active booking. Cancel or complete that booking first, or keep the window wide enough to include it.");
        }
    }

    private void ApplyHallDetails(Hall hall, UpdateOwnerHallRequest request)
    {
        hall.Name = request.Name.Trim();
        // Edits 18/29: the edit form resolves covers to absolute display URLs; persisting
        // those verbatim pins the deployment origin into every stored image and breaks all
        // of them on the next environment move. Normalize back to API-relative storage.
        hall.MainImageUrl = HallMediaUrl.NormalizePersistedUrl(request.MainImageUrl);
        hall.ContactPhone = NormalizeOptional(request.ContactPhone);
        hall.Region = request.Region;
        hall.Description = NormalizeOptional(request.Description);
        hall.Capacity = request.Capacity;
        hall.Price = request.Price;
        hall.ShowPrice = request.ShowPrice;

        ApplyAddress(hall, request);
        hall.DetailedAddress = NormalizeOptional(request.DetailedAddress);
        hall.YouTubeVideoUrl = NormalizeOptional(request.YouTubeVideoUrl);
        hall.OtherFeatures = NormalizeOptional(request.OtherFeatures);
        ApplyFeatures(hall, request.Features);

        ApplyPhotos(hall, request.Photos);
        hall.HourlySlotStart = request.HourlySlotStart;
        hall.HourlySlotEnd = request.HourlySlotEnd;
    }

    /// <summary>
    /// The address is a dependent selection: it must belong to the hall's region list.
    /// It is only re-validated on an actual change, so a hall whose stored address
    /// predates the catalog (or predates this list-backed rule) can still edit the rest
    /// of its details and be re-reviewed without first re-picking a value.
    /// </summary>
    private static void ApplyAddress(Hall hall, UpdateOwnerHallRequest request)
    {
        var incoming = request.Address.Trim();

        if (string.Equals(incoming, hall.Address, StringComparison.Ordinal))
        {
            return;
        }

        if (!RegionAddressCatalog.Contains(request.Region, incoming))
        {
            throw new BusinessRuleException(
                "AddressNotInRegion",
                "The address must be selected from the selected region's address list.");
        }

        hall.Address = incoming;
    }

    private static void ApplyFeatures(Hall hall, IReadOnlyList<string> features)
    {
        var normalized = HallFeatureCatalog.Normalize(features);

        foreach (var feature in normalized)
        {
            if (!HallFeatureCatalog.IsPredefined(feature))
            {
                throw new BusinessRuleException(
                    "FeatureNotPredefined",
                    $"The feature \"{feature}\" is not in the predefined feature list.");
            }
        }

        var existing = hall.Features.ToList();
        foreach (var item in existing)
        {
            hall.Features.Remove(item);
        }

        foreach (var name in normalized)
        {
            hall.Features.Add(new HallFeature { HallId = hall.Id, Name = name });
        }
    }

    private void ApplyPhotos(Hall hall, IReadOnlyList<UpdateOwnerHallPhotoDto> photos)
    {
        // Replace the gallery: previous photos are soft-deleted (HallImage.IsDeleted)
        // so reads return exactly the new set while the history is preserved.
        foreach (var existing in hall.Images.Where(image => !image.IsDeleted))
        {
            existing.IsDeleted = true;
        }

        // New photos are registered through the repository (EF relationship fixup
        // attaches them to the aggregate for the response mapping). Gallery URLs get
        // the same absolute-to-relative normalization as the cover (Edits 18/29).
        var normalized = photos
            .Select(photo => new HallImage
            {
                HallId = hall.Id,
                Url = HallMediaUrl.NormalizePersistedUrl(photo.Url) ?? photo.Url.Trim(),
                DisplayOrder = photo.DisplayOrder
            })
            .ToList();
        _ownerDashboardRepository.AddHallImages(normalized);

        // Write-time cover invariant (Edits 18/29): a blank cover with a non-empty
        // gallery leaves every card endpoint with a null image, so default the cover
        // to the first gallery photo instead of persisting a coverless hall.
        if (string.IsNullOrWhiteSpace(hall.MainImageUrl))
        {
            hall.MainImageUrl = normalized
                .OrderBy(image => image.DisplayOrder)
                .Select(image => image.Url)
                .FirstOrDefault(url => !string.IsNullOrWhiteSpace(url));
        }
    }

    private static OwnerHallDetailsDto MapToDetails(Hall hall)
        => new()
        {
            HallId = hall.Id,
            HallName = hall.Name,
            MainImageUrl = HallMediaUrl.ResolveCoverUrl(
                hall.MainImageUrl,
                hall.Images
                    .Where(image => !image.IsDeleted)
                    .OrderBy(image => image.DisplayOrder)
                    .ThenBy(image => image.CreatedAt)
                    .Select(image => image.Url)),
            ContactPhone = hall.ContactPhone,
            Region = hall.Region,
            RegionDisplayName = HallDisplayNames.GetRegionDisplayName(hall.Region),
            Address = hall.Address,
            DetailedAddress = hall.DetailedAddress,
            Description = hall.Description,
            Capacity = hall.Capacity,
            Price = hall.Price,
            ShowPrice = hall.ShowPrice,
            YouTubeVideoUrl = hall.YouTubeVideoUrl,
            Features = hall.Features
                .Select(feature => feature.Name)
                .OrderBy(name => name, StringComparer.Ordinal)
                .ToList(),
            OtherFeatures = hall.OtherFeatures,
            Status = hall.Status,
            IsEditable = true,
            PaymentStatus = hall.PaymentStatus,
            HourlySlotStart = hall.HourlySlotStart,
            HourlySlotEnd = hall.HourlySlotEnd,
            ShowBookedSlots = hall.ShowBookedSlots,
            Photos = hall.Images
                .Where(image => !image.IsDeleted)
                .OrderBy(image => image.DisplayOrder)
                .ThenBy(image => image.CreatedAt)
                .Select(image => new OwnerHallPhotoDto
                {
                    Id = image.Id,
                    Url = image.Url,
                    DisplayOrder = image.DisplayOrder
                })
                .ToList()
        };

    private static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}