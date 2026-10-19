using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Documents;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Profile;

public sealed class ProfessionalProfileService : IProfessionalProfileService
{
    private const int MaxBioLength = 300;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ICurrentUserService _currentUser;
    private readonly ICoordinatorRepository _coordinators;
    private readonly IPhotographerRepository _photographers;
    private readonly IUserContentPublishingRestrictionService _restrictions;
    private readonly IIdentityDocumentStore _documents;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPostService _posts;
    private readonly IProfessionalOfferService _offers;

    public ProfessionalProfileService(
        UserManager<ApplicationUser> userManager,
        ICurrentUserService currentUser,
        ICoordinatorRepository coordinators,
        IPhotographerRepository photographers,
        IUserContentPublishingRestrictionService restrictions,
        IIdentityDocumentStore documents,
        IUnitOfWork unitOfWork,
        IPostService posts,
        IProfessionalOfferService offers)
    {
        _userManager = userManager;
        _currentUser = currentUser;
        _coordinators = coordinators;
        _photographers = photographers;
        _restrictions = restrictions;
        _documents = documents;
        _unitOfWork = unitOfWork;
        _posts = posts;
        _offers = offers;
    }

    public async Task<PublicProfessionalProfileResponse> GetPublicProfileAsync(string userId, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            throw new NotFoundException("Profile", userId);

        var roles = await _userManager.GetRolesAsync(user);
        var role = roles.FirstOrDefault(r => r is ApplicationRoles.EventCoordinator or ApplicationRoles.Photographer);
        if (role is null)
            throw new NotFoundException("Profile", userId);

        if (user.ApprovalStatus != AccountApprovalStatus.Approved)
        {
            if (_currentUser.IsAuthenticated && string.Equals(_currentUser.UserId, userId, StringComparison.Ordinal))
            {
                return new PublicProfessionalProfileResponse
                {
                    UserId = userId,
                    Role = role,
                    ApprovalStatus = user.ApprovalStatus.ToString(),
                    IsPubliclyAvailable = false
                };
            }

            throw new NotFoundException("Profile", userId);
        }

        if (role == ApplicationRoles.EventCoordinator)
        {
            var profile = await _coordinators.GetByUserIdAsync(userId, cancellationToken)
                ?? throw new NotFoundException("Profile", userId);
            var displayName = profile.BusinessType == CoordinatorBusinessType.Shop ? profile.ShopName : profile.OnlineStoreName;
            var posts = await _posts.ListProfileAsync(userId, 1, 6, cancellationToken);
            var offers = await _offers.ListProfileAsync(userId, 1, 6, cancellationToken);
            return new PublicProfessionalProfileResponse
            {
                UserId = userId,
                Role = role,
                IsPubliclyAvailable = true,
                DisplayName = displayName,
                ShopName = profile.BusinessType == CoordinatorBusinessType.Shop ? profile.ShopName : null,
                OnlineStoreName = profile.BusinessType == CoordinatorBusinessType.Freelance ? profile.OnlineStoreName : null,
                PhoneNumber = profile.PhoneNumber,
                ShopLocation = profile.BusinessType == CoordinatorBusinessType.Shop ? profile.ShopLocation : null,
                Bio = profile.Bio,
                ProfilePictureUrl = user.ProfilePictureUrl,
                Posts = posts.Items,
                Offers = offers.Items
            };
        }

        var photographer = await _photographers.GetByUserIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException("Profile", userId);
        var photographerPosts = await _posts.ListProfileAsync(userId, 1, 6, cancellationToken);
        var photographerOffers = await _offers.ListProfileAsync(userId, 1, 6, cancellationToken);
        return new PublicProfessionalProfileResponse
        {
            UserId = userId,
            Role = role,
            IsPubliclyAvailable = true,
            DisplayName = PublicProfiles.ResolveDisplayName(photographer.HasStudio ? photographer.StudioName : null),
            StudioName = photographer.HasStudio ? photographer.StudioName : null,
            StudioLocation = photographer.HasStudio ? photographer.StudioLocation : null,
            DetailedStudioLocation = photographer.HasStudio ? photographer.DetailedStudioLocation : null,
            PhoneNumber = photographer.HasStudio ? photographer.PhoneNumber : null,
            Bio = photographer.Bio,
            ProfilePictureUrl = user.ProfilePictureUrl,
            Posts = photographerPosts.Items,
            Offers = photographerOffers.Items
        };
    }

    public async Task UpdateBioAsync(UpdatePublicBioRequest request, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var user = await GetEditableOwnerAsync(cancellationToken);
        var bio = SanitizeBio(request.Bio);
        if (bio.Length > MaxBioLength)
            throw new ValidationException(new Dictionary<string, string[]> { ["Bio"] = [$"Bio cannot exceed {MaxBioLength} characters."] });

        var roles = await _userManager.GetRolesAsync(user);
        if (roles.Contains(ApplicationRoles.EventCoordinator))
        {
            var profile = await _coordinators.GetByUserIdAsync(user.Id, cancellationToken) ?? throw new NotFoundException("Profile", user.Id);
            profile.Bio = bio.Length == 0 ? null : bio;
            await _coordinators.UpdateAsync(profile, cancellationToken);
        }
        else if (roles.Contains(ApplicationRoles.Photographer))
        {
            var profile = await _photographers.GetByUserIdAsync(user.Id, cancellationToken) ?? throw new NotFoundException("Profile", user.Id);
            profile.Bio = bio.Length == 0 ? null : bio;
            await _photographers.UpdateAsync(profile, cancellationToken);
        }
        else
            throw new ForbiddenException("Only approved coordinators and photographers can edit a public profile.");
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<string> UploadProfilePictureAsync(OwnerDocumentUpload upload, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var user = await GetEditableOwnerAsync(cancellationToken);
        DocumentUploadValidator.EnsureValidImage(upload);
        var roles = await _userManager.GetRolesAsync(user);
        var isCoordinator = roles.Contains(ApplicationRoles.EventCoordinator);
        if (!isCoordinator && !roles.Contains(ApplicationRoles.Photographer))
            throw new ForbiddenException("Only approved coordinators and photographers can edit a public profile.");

        var extension = upload.ContentType.ToLowerInvariant() switch
        {
            "image/jpeg" => ".jpg",
            "image/png" => ".png",
            "image/webp" => ".webp",
            _ => throw new ValidationException("The profile picture type is not supported.")
        };
        var storageKey = ProfilePictureKey(user.Id, isCoordinator, extension);
        var previousStorageKey = user.ProfilePictureStorageKey;
        await _documents.SaveAsync(storageKey, upload.Content, cancellationToken);
        user.ProfilePictureUrl = $"/api/v1/profile/{Uri.EscapeDataString(user.Id)}/picture";
        user.ProfilePictureContentType = upload.ContentType.ToLowerInvariant();
        user.ProfilePictureStorageKey = storageKey;
        try
        {
            var result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded)
                throw new ValidationException(result.Errors.GroupBy(e => e.Code).ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray()));
        }
        catch
        {
            try { await _documents.DeleteAsync(storageKey, cancellationToken); }
            catch { /* The failed database update remains the primary error. */ }
            throw;
        }
        if (!string.IsNullOrWhiteSpace(previousStorageKey) && previousStorageKey != storageKey)
        {
            try { await _documents.DeleteAsync(previousStorageKey, cancellationToken); }
            catch { /* A stale public profile image is harmless; the new key is persisted. */ }
        }
        return user.ProfilePictureUrl;
    }

    public async Task<StoredDocument> GetProfilePictureAsync(string userId, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null || user.ApprovalStatus != AccountApprovalStatus.Approved || string.IsNullOrWhiteSpace(user.ProfilePictureStorageKey))
            throw new NotFoundException("Profile picture", userId);
        var roles = await _userManager.GetRolesAsync(user);
        if (!roles.Contains(ApplicationRoles.EventCoordinator) && !roles.Contains(ApplicationRoles.Photographer))
            throw new NotFoundException("Profile picture", userId);
        var stored = await _documents.ReadAsync(user.ProfilePictureStorageKey, cancellationToken)
            ?? throw new NotFoundException("Profile picture", userId);
        return new StoredDocument
        {
            RelativeUrl = user.ProfilePictureStorageKey,
            Content = stored.Bytes,
            FullPath = stored.LocalPath ?? string.Empty,
            ContentType = user.ProfilePictureContentType ?? "application/octet-stream",
            FileName = "profile-picture"
        };
    }

    private async Task<ApplicationUser> GetEditableOwnerAsync(CancellationToken cancellationToken)
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
            throw new UnauthorizedException("You must be logged in to edit your profile.");
        var user = await _userManager.FindByIdAsync(_currentUser.UserId)
            ?? throw new NotFoundException("User", _currentUser.UserId);
        if (user.ApprovalStatus != AccountApprovalStatus.Approved)
            throw new ForbiddenException("Your account must be approved before you can edit your public profile.");
        if (await _restrictions.GetRestrictedUntilAsync(user.Id, cancellationToken) is { } restrictedUntil)
            throw new ForbiddenException($"Your account is restricted from editing content until {restrictedUntil:O}.");
        return user;
    }

    private static string SanitizeBio(string? bio)
    {
        if (string.IsNullOrWhiteSpace(bio)) return string.Empty;
        var plainText = Regex.Replace(bio, "<[^>]*>", string.Empty);
        plainText = new string(plainText.Where(c => !char.IsControl(c) || c is '\r' or '\n' or '\t').ToArray());
        return Regex.Replace(plainText, @"\s+", " ").Trim();
    }

    private static string ProfilePictureKey(string userId, bool isCoordinator, string extension)
    {
        var roleSegment = isCoordinator ? "coordinators" : "photographers";
        return $"/documents/{roleSegment}/{userId}/profile-picture-{Guid.NewGuid():N}{extension}";
    }
}
