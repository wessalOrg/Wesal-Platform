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
/// (US-ADMIN-05/07/09) and editing is blocked while the hall is under Admin review
/// (PendingReview). The update is applied atomically in a single transaction and
/// never touches the hall's approval status or owner identity — except for the
/// resubmission rule (FR-ADM-01): editing a Rejected hall re-queues it to
/// PendingReview.
/// </summary>
public sealed class OwnerHallService : IOwnerHallService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ICurrentUserService _currentUser;
    private readonly IOwnerDashboardRepository _ownerDashboardRepository;
    private readonly IUnitOfWork _unitOfWork;

    public OwnerHallService(
        UserManager<ApplicationUser> userManager,
        ICurrentUserService currentUser,
        IOwnerDashboardRepository ownerDashboardRepository,
        IUnitOfWork unitOfWork)
    {
        _userManager = userManager;
        _currentUser = currentUser;
        _ownerDashboardRepository = ownerDashboardRepository;
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

        HallManagementAccess.EnsureAllowed(hall);
        EnsureEditable(hall);

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

    private static void EnsureEditable(Hall hall)
    {
        // Editing is blocked while the hall is under Admin review (PendingReview).
        // The management-access gate (HallManagementAccess, US-ADMIN-05/07/09) is
        // enforced before this check so a locked hall surfaces the correct lock code.
        if (hall.Status == HallStatus.PendingReview)
        {
            throw new BusinessRuleException(
                "HallNotEditable",
                "This hall is under review and cannot be edited right now.");
        }
    }

    private void ApplyHallDetails(Hall hall, UpdateOwnerHallRequest request)
    {
        hall.Name = request.Name.Trim();
        hall.MainImageUrl = NormalizeOptional(request.MainImageUrl);
        hall.ContactPhone = NormalizeOptional(request.ContactPhone);
        hall.Region = request.Region;
        hall.Address = request.Address.Trim();
        hall.Description = NormalizeOptional(request.Description);
        hall.Capacity = request.Capacity;
        hall.Price = request.Price;
        hall.ShowPrice = request.ShowPrice;

        ApplyDetailedAddress(hall, request);
        hall.YouTubeVideoUrl = NormalizeOptional(request.YouTubeVideoUrl);
        hall.OtherFeatures = NormalizeOptional(request.OtherFeatures);
        ApplyFeatures(hall, request.Features);

        ApplyPhotos(hall, request.Photos);
        hall.HourlySlotStart = request.HourlySlotStart;
        hall.HourlySlotEnd = request.HourlySlotEnd;
    }

    /// <summary>
    /// The detailed address is a dependent selection: it must belong to the hall's
    /// region list. It is only re-validated on an actual change so existing halls whose
    /// address predates the catalog can keep editing the rest of their details.
    /// </summary>
    private static void ApplyDetailedAddress(Hall hall, UpdateOwnerHallRequest request)
    {
        var incoming = string.IsNullOrWhiteSpace(request.DetailedAddress) ? null : request.DetailedAddress.Trim();

        if (string.Equals(incoming, hall.DetailedAddress, StringComparison.Ordinal))
        {
            return;
        }

        if (incoming is not null && !RegionAddressCatalog.Contains(request.Region, incoming))
        {
            throw new BusinessRuleException(
                "DetailedAddressNotInRegion",
                "The detailed address must be selected from the selected region's address list.");
        }

        hall.DetailedAddress = incoming;
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
            IsEditable = hall.Status != HallStatus.PendingReview,
            PaymentStatus = hall.PaymentStatus,
            PaymentReceiptUploadedAt = hall.PaymentReceiptUploadedAt,
            HasPaymentReceipt = !string.IsNullOrWhiteSpace(hall.PaymentReceiptUrl),
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