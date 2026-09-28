using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Catalogs;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Halls;

public class HallCreationService : IHallCreationService
{
    private readonly ICurrentUserService _currentUser;
    private readonly IHallRepository _hallRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IHallMediaStorage _mediaStorage;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly INotificationDispatcher _notificationDispatcher;

    public HallCreationService(
        ICurrentUserService currentUser,
        IHallRepository hallRepository,
        IUnitOfWork unitOfWork,
        IHallMediaStorage mediaStorage,
        UserManager<ApplicationUser> userManager,
        INotificationDispatcher notificationDispatcher)
    {
        _currentUser = currentUser;
        _hallRepository = hallRepository;
        _unitOfWork = unitOfWork;
        _mediaStorage = mediaStorage;
        _userManager = userManager;
        _notificationDispatcher = notificationDispatcher;
    }

    public async Task<CreateHallResponse> CreateHallAsync(CreateHallRequest request, CancellationToken cancellationToken = default)
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
            throw new UnauthorizedException("You must be logged in to create a hall.");

        if (!_currentUser.Roles.Any(r => string.Equals(r, ApplicationRoles.HallOwner, StringComparison.OrdinalIgnoreCase)))
            throw new ForbiddenException("Only Hall Owners can create halls.");

        var ownerId = _currentUser.UserId!;

        // Identity document is mandatory before creating a hall (US-OWNER-30):
        // a Hall Owner without the uploaded identity document cannot add halls.
        await EnsureIdentityDocumentUploadedAsync(ownerId);

        // Basic required field validation (service-level, before persistence)
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ValidationException(new Dictionary<string, string[]> { ["Name"] = new[] { "Hall name is required." } });
        if (string.IsNullOrWhiteSpace(request.ContactPhone))
            throw new ValidationException(new Dictionary<string, string[]> { ["ContactPhone"] = new[] { "Contact phone is required." } });
        if (string.IsNullOrWhiteSpace(request.Address))
            throw new ValidationException(new Dictionary<string, string[]> { ["Address"] = new[] { "Address is required." } });
        if (request.Capacity <= 0)
            throw new ValidationException(new Dictionary<string, string[]> { ["Capacity"] = new[] { "Capacity must be greater than 0." } });
        // Region validation
        if (!TryParseRegion(request.Region, out var region))
            throw new ValidationException(new Dictionary<string, string[]> { ["Region"] = new[] { "Region must be one of: North Gaza, Gaza, Middle Area, South Gaza." } });

        // Dependent Region → Address rule (US-HALL): the address is selected from the
        // region's predefined list and must belong to it. The detailed address is the
        // owner's own free-text detail and is not list-validated.
        if (!RegionAddressCatalog.Contains(region, request.Address))
            throw new ValidationException(new Dictionary<string, string[]> { ["Address"] = new[] { "The address does not belong to the selected region's address list." } });

        if (!string.IsNullOrWhiteSpace(request.YouTubeVideoUrl) && !YoutubeUrlValidator.IsValid(request.YouTubeVideoUrl))
            throw new ValidationException(new Dictionary<string, string[]> { ["YouTubeVideoUrl"] = new[] { "Enter a valid YouTube link (youtube.com or youtu.be)." } });

        if (!string.IsNullOrWhiteSpace(request.OtherFeatures) && request.OtherFeatures.Trim().Length > HallFeatureCatalog.OtherFeaturesMaxLength)
            throw new ValidationException(new Dictionary<string, string[]> { ["OtherFeatures"] = new[] { $"Additional features must not exceed {HallFeatureCatalog.OtherFeaturesMaxLength} characters." } });

        var features = HallFeatureCatalog.Normalize(request.Features);
        foreach (var feature in features)
        {
            if (!HallFeatureCatalog.IsPredefined(feature))
                throw new ValidationException(new Dictionary<string, string[]> { ["Features"] = new[] { $"The feature \"{feature}\" is not in the predefined feature list." } });
        }

        // Photo validation before persistence (shared gallery rules, Edit 24).
        var validatedPhotos = new List<(string OriginalName, string Extension, string MimeType, byte[] Content)>();
        if (request.Photos != null)
        {
            foreach (var photo in request.Photos)
            {
                if (photo is null)
                    throw new ValidationException(new Dictionary<string, string[]> { ["Photos"] = new[] { "Invalid photo." } });

                HallPhotoUploadValidator.EnsureValidImage(photo, "Photos");

                validatedPhotos.Add((photo.FileName, Path.GetExtension(photo.FileName).ToLowerInvariant(), photo.ContentType, photo.Content));
            }
        }

        // The cover photo is validated with the same rules as the gallery.
        if (request.MainPhoto != null && request.MainPhoto.Content.Length > 0)
        {
            HallPhotoUploadValidator.EnsureValidImage(request.MainPhoto, "MainPhoto");
        }

        var hall = new Hall
        {
            Name = request.Name.Trim(),
            ContactPhone = request.ContactPhone.Trim(),
            Region = region,
            Address = request.Address.Trim(),
            DetailedAddress = string.IsNullOrWhiteSpace(request.DetailedAddress) ? null : request.DetailedAddress.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            Capacity = request.Capacity,
            Price = request.Price,
            ShowPrice = request.Price.HasValue,
            YouTubeVideoUrl = string.IsNullOrWhiteSpace(request.YouTubeVideoUrl) ? null : request.YouTubeVideoUrl.Trim(),
            OtherFeatures = string.IsNullOrWhiteSpace(request.OtherFeatures) ? null : request.OtherFeatures.Trim(),
            HourlySlotStart = request.HourlySlotStart,
            HourlySlotEnd = request.HourlySlotEnd,
            OwnerId = ownerId,
            Status = HallStatus.PendingReview,
            IsDeleted = false
        };

        var uploadsRoot = _mediaStorage.HallsUploadDirectory(hall.Id);

        try
        {
            var result = await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                hall.Features = features
                    .Select(name => new HallFeature { HallId = hall.Id, Name = name })
                    .ToList();

                var images = new List<HallImage>();
                Directory.CreateDirectory(uploadsRoot);

                int order = 0;
                foreach (var photo in validatedPhotos)
                {
                    var fileName = $"{Guid.NewGuid()}{photo.Extension}";
                    var filePath = Path.Combine(uploadsRoot, fileName);
                    await File.WriteAllBytesAsync(filePath, photo.Content, cancellationToken);
                    var url = $"/uploads/halls/{hall.Id}/{fileName}";
                    var image = new HallImage { HallId = hall.Id, Url = url, DisplayOrder = order++, IsDeleted = false };
                    images.Add(image);
                }
                hall.Images = images;

                // Cover photo (MainImageUrl) wins over the first gallery photo; it is not
                // duplicated into the gallery list.
                if (request.MainPhoto != null && request.MainPhoto.Content.Length > 0)
                {
                    var mainFileName = $"{Guid.NewGuid()}{Path.GetExtension(request.MainPhoto.FileName).ToLowerInvariant()}";
                    await File.WriteAllBytesAsync(Path.Combine(uploadsRoot, mainFileName), request.MainPhoto.Content, cancellationToken);
                    hall.MainImageUrl = $"/uploads/halls/{hall.Id}/{mainFileName}";
                }
                else if (images.Count > 0)
                {
                    hall.MainImageUrl = images[0].Url;
                }

                await _hallRepository.AddAsync(hall, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);

                return new CreateHallResponse
                {
                    HallId = hall.Id,
                    Name = hall.Name,
                    ContactPhone = hall.ContactPhone!,
                    Region = hall.Region,
                    Address = hall.Address,
                    DetailedAddress = hall.DetailedAddress,
                    MainImageUrl = hall.MainImageUrl,
                    YouTubeVideoUrl = hall.YouTubeVideoUrl,
                    OtherFeatures = hall.OtherFeatures,
                    Features = hall.Features.Select(feature => feature.Name).ToList(),
                    Description = hall.Description!,
                    Capacity = hall.Capacity,
                    Price = hall.Price,
                    Status = hall.Status,
                    // DisplayOrder is carried through so the create response reports the
                    // real gallery position for each image (WESAL-TASK-5, Edit 5) rather
                    // than defaulting every entry to 0.
                    Images = images
                        .Select(i => new HallImageDto { Id = i.Id, Url = i.Url, DisplayOrder = i.DisplayOrder })
                        .ToList()
                };
            }, cancellationToken);

            // WESAL-TASK-13 (Edit 13): the hall exists and is committed, so it is now safe to
            // tell people about it. Two recipients, each in their own language: the owner is
            // told it is awaiting review (routed to "My halls"), and Admins are told a hall is
            // waiting for them (routed to the hall-requests review list). Both dispatches are
            // best-effort, so a realtime failure cannot fail the creation the owner just paid
            // the effort to complete.
            await NotifyHallSubmittedAsync(result.HallId, result.Name, ownerId, cancellationToken);

            return result;
        }
        catch
        {
            // Rollback already happened inside the unit of work; clean up any files written.
            try
            {
                if (Directory.Exists(uploadsRoot))
                    Directory.Delete(uploadsRoot, true);
            }
            catch { }
            throw;
        }
    }

    /// <summary>
    /// Announces a newly submitted hall (WESAL-TASK-13, Edit 13): the owner is told it is
    /// awaiting review, and every Admin is told a hall is waiting for them.
    /// </summary>
    /// <remarks>
    /// The Admin list is resolved from the database rather than from a configured id, so a
    /// hall is never left unreviewed because a hard-coded admin account was renamed. If the
    /// deployment has no Admin account at all, the owner still gets their notification and
    /// only the Admin alert is skipped.
    /// </remarks>
    private async Task NotifyHallSubmittedAsync(
        Guid hallId,
        string hallName,
        string ownerId,
        CancellationToken cancellationToken)
    {
        var values = new Dictionary<string, string?>
        {
            [NotificationTokens.HallName] = hallName
        };

        await _notificationDispatcher.DispatchAsync(
            NotificationKind.HallCreatedForOwner,
            ownerId,
            values,
            hallId.ToString(),
            cancellationToken);

        var adminIds = await ResolveAdminUserIdsAsync(cancellationToken);

        foreach (var adminId in adminIds)
        {
            await _notificationDispatcher.DispatchAsync(
                NotificationKind.HallSubmittedForAdmin,
                adminId,
                values,
                hallId.ToString(),
                cancellationToken);
        }
    }

    private async Task<IReadOnlyList<string>> ResolveAdminUserIdsAsync(CancellationToken cancellationToken)
    {
        var admins = await _userManager.GetUsersInRoleAsync(ApplicationRoles.Admin);

        return admins
            .Select(admin => admin.Id)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .ToList();
    }

    private async Task EnsureIdentityDocumentUploadedAsync(string ownerId)
    {
        var user = await _userManager.FindByIdAsync(ownerId);
        if (user is null)
            throw new NotFoundException("User", ownerId);

        if (string.IsNullOrWhiteSpace(user.IdentityDocumentUrl))
            throw new ForbiddenException("You must upload your identity document in your profile before you can create a hall.");
    }

    private static bool TryParseRegion(string input, out HallRegion region)
    {
        var normalized = input.Trim().ToLowerInvariant().Replace(" ", "");
        switch (normalized)
        {
            case "northgaza": region = HallRegion.NorthGaza; return true;
            case "gaza": region = HallRegion.Gaza; return true;
            case "middlearea": region = HallRegion.MiddleArea; return true;
            case "southgaza": region = HallRegion.SouthGaza; return true;
            default: region = default; return false;
        }
    }
}
