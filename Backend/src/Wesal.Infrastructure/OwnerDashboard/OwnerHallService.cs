using Microsoft.AspNetCore.Identity;
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
    private readonly IUnitOfWork _unitOfWork;

    public OwnerHallService(
        UserManager<ApplicationUser> userManager,
        ICurrentUserService currentUser,
        IOwnerDashboardRepository ownerDashboardRepository,
        IBookingRepository bookingRepository,
        IUnitOfWork unitOfWork)
    {
        _userManager = userManager;
        _currentUser = currentUser;
        _ownerDashboardRepository = ownerDashboardRepository;
        _bookingRepository = bookingRepository;
        _unitOfWork = unitOfWork;
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

        // The hall-details update carries the same bookable-window fields as the
        // dedicated hourly-settings endpoint, so it enforces the same rules: the
        // *effective* window (request merged over persisted values) must be ordered
        // whole hours, and narrowing it past a live booking is refused with the same
        // ConflictException the hourly-settings path uses, so this endpoint can never
        // strand an active booking by reshaping the window around it.
        await EnsureWindowChangeAllowedAsync(hall, request, cancellationToken);

        await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            ApplyHallDetails(hall, request);

            // Resubmission (FR-ADM-01, US-ADMIN-03): editing a Rejected hall re-queues
            // it for review. Editing an Approved or PendingReview hall never changes
            // its approval state.
            if (hall.Status == HallStatus.Rejected)
            {
                hall.Status = HallStatus.PendingReview;
            }

            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }, cancellationToken);

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

        var windowStart = effectiveStart ?? new TimeOnly(9, 0);
        var windowEnd = effectiveEnd ?? new TimeOnly(22, 0);

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
        hall.MainImageUrl = NormalizeOptional(request.MainImageUrl);
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
        // attaches them to the aggregate for the response mapping).
        _ownerDashboardRepository.AddHallImages(photos
            .Select(photo => new HallImage
            {
                HallId = hall.Id,
                Url = photo.Url.Trim(),
                DisplayOrder = photo.DisplayOrder
            })
            .ToList());
    }

    private static OwnerHallDetailsDto MapToDetails(Hall hall)
        => new()
        {
            HallId = hall.Id,
            HallName = hall.Name,
            MainImageUrl = hall.MainImageUrl,
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