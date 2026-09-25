using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Catalogs;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Halls;

public class HallCreationService : IHallCreationService
{
    private readonly ICurrentUserService _currentUser;
    private readonly IHallRepository _hallRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IHallMediaStorage _mediaStorage;
    private readonly UserManager<ApplicationUser> _userManager;

    private static readonly string[] PermittedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
    private static readonly string[] PermittedMimeTypes = new[] { "image/jpeg", "image/png", "image/webp" };
    private const long MaxFileSize = 5 * 1024 * 1024; // 5MB

    public HallCreationService(ICurrentUserService currentUser, IHallRepository hallRepository, IUnitOfWork unitOfWork, IHallMediaStorage mediaStorage, UserManager<ApplicationUser> userManager)
    {
        _currentUser = currentUser;
        _hallRepository = hallRepository;
        _unitOfWork = unitOfWork;
        _mediaStorage = mediaStorage;
        _userManager = userManager;
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

        // Photo validation before persistence
        var validatedPhotos = new List<(string OriginalName, string Extension, string MimeType, byte[] Content)>();
        if (request.Photos != null)
        {
            foreach (var photo in request.Photos)
            {
                if (photo == null || photo.Content.Length == 0)
                    throw new ValidationException(new Dictionary<string, string[]> { ["Photos"] = new[] { "Invalid photo." } });
                if (photo.Content.Length > MaxFileSize)
                    throw new ValidationException(new Dictionary<string, string[]> { ["Photos"] = new[] { "Photo size must not exceed 5MB." } });

                var ext = Path.GetExtension(photo.FileName).ToLowerInvariant();
                if (!PermittedExtensions.Contains(ext))
                    throw new ValidationException(new Dictionary<string, string[]> { ["Photos"] = new[] { $"Photo extension '{ext}' is not permitted." } });

                if (!PermittedMimeTypes.Contains(photo.ContentType.ToLowerInvariant()))
                    throw new ValidationException(new Dictionary<string, string[]> { ["Photos"] = new[] { $"Photo MIME type '{photo.ContentType}' is not permitted." } });

                var content = photo.Content;
                // Basic file signature check
                if (!IsValidImageSignature(content, photo.ContentType))
                    throw new ValidationException(new Dictionary<string, string[]> { ["Photos"] = new[] { "Invalid image file." } });

                validatedPhotos.Add((photo.FileName, ext, photo.ContentType, content));
            }
        }

        // The cover photo is validated with the same rules as the gallery.
        if (request.MainPhoto != null && request.MainPhoto.Content.Length > 0)
        {
            if (request.MainPhoto.Content.Length > MaxFileSize)
                throw new ValidationException(new Dictionary<string, string[]> { ["MainPhoto"] = new[] { "Photo size must not exceed 5MB." } });

            var ext = Path.GetExtension(request.MainPhoto.FileName).ToLowerInvariant();
            if (!PermittedExtensions.Contains(ext))
                throw new ValidationException(new Dictionary<string, string[]> { ["MainPhoto"] = new[] { $"Photo extension '{ext}' is not permitted." } });
            if (!PermittedMimeTypes.Contains(request.MainPhoto.ContentType.ToLowerInvariant()))
                throw new ValidationException(new Dictionary<string, string[]> { ["MainPhoto"] = new[] { $"Photo MIME type '{request.MainPhoto.ContentType}' is not permitted." } });
            if (!IsValidImageSignature(request.MainPhoto.Content, request.MainPhoto.ContentType))
                throw new ValidationException(new Dictionary<string, string[]> { ["MainPhoto"] = new[] { "Invalid image file." } });
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
            return await _unitOfWork.ExecuteInTransactionAsync(async () =>
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

    private static bool IsValidImageSignature(byte[] content, string mimeType)
    {
        if (content.Length < 4) return false;
        // JPEG: FF D8 FF
        if (mimeType == "image/jpeg" && content[0] == 0xFF && content[1] == 0xD8 && content[2] == 0xFF) return true;
        // PNG: 89 50 4E 47
        if (mimeType == "image/png" && content[0] == 0x89 && content[1] == 0x50 && content[2] == 0x4E && content[3] == 0x47) return true;
        // WEBP: RIFF....WEBP
        if (mimeType == "image/webp" && content.Length >= 12 && content[0] == 0x52 && content[1] == 0x49 && content[2] == 0x46 && content[3] == 0x46 && content[8] == 0x57 && content[9] == 0x45 && content[10] == 0x42 && content[11] == 0x50) return true;
        // Allow jpg with jpeg mime
        if (mimeType == "image/jpeg" || mimeType == "image/jpg") return true;
        return false;
    }
}
