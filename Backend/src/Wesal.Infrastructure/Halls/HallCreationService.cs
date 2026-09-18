using Microsoft.AspNetCore.Hosting;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Halls;

public class HallCreationService : IHallCreationService
{
    private readonly ICurrentUserService _currentUser;
    private readonly IHallRepository _hallRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IWebHostEnvironment _env;

    private static readonly string[] PermittedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
    private static readonly string[] PermittedMimeTypes = new[] { "image/jpeg", "image/png", "image/webp" };
    private const long MaxFileSize = 5 * 1024 * 1024; // 5MB

    public HallCreationService(ICurrentUserService currentUser, IHallRepository hallRepository, IUnitOfWork unitOfWork, IWebHostEnvironment env)
    {
        _currentUser = currentUser;
        _hallRepository = hallRepository;
        _unitOfWork = unitOfWork;
        _env = env;
    }

    public async Task<CreateHallResponse> CreateHallAsync(CreateHallRequest request, CancellationToken cancellationToken = default)
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
            throw new UnauthorizedException("You must be logged in to create a hall.");

        if (!_currentUser.Roles.Any(r => string.Equals(r, ApplicationRoles.HallOwner, StringComparison.OrdinalIgnoreCase)))
            throw new ForbiddenException("Only Hall Owners can create halls.");

        var ownerId = _currentUser.UserId!;
        // Basic required field validation (service-level, before persistence)
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ValidationException(new Dictionary<string, string[]> { ["Name"] = new[] { "Hall name is required." } });
        if (string.IsNullOrWhiteSpace(request.ContactPhone))
            throw new ValidationException(new Dictionary<string, string[]> { ["ContactPhone"] = new[] { "Contact phone is required." } });
        if (string.IsNullOrWhiteSpace(request.Address))
            throw new ValidationException(new Dictionary<string, string[]> { ["Address"] = new[] { "Address is required." } });
        if (string.IsNullOrWhiteSpace(request.Description))
            throw new ValidationException(new Dictionary<string, string[]> { ["Description"] = new[] { "Description is required." } });
        if (request.Capacity <= 0)
            throw new ValidationException(new Dictionary<string, string[]> { ["Capacity"] = new[] { "Capacity must be greater than 0." } });
        // Region validation
        if (!TryParseRegion(request.Region, out var region))
            throw new ValidationException(new Dictionary<string, string[]> { ["Region"] = new[] { "Region must be one of: North Gaza, Gaza, Middle Area, South Gaza." } });

        // Period validation already done via validator, but double-check
        if (request.FirstPeriodEnd <= request.FirstPeriodStart)
            throw new ValidationException(new Dictionary<string, string[]> { ["FirstPeriodEnd"] = new[] { "First period end time must be after start time." } });
        if (request.SecondPeriodEnd <= request.SecondPeriodStart)
            throw new ValidationException(new Dictionary<string, string[]> { ["SecondPeriodEnd"] = new[] { "Second period end time must be after start time." } });

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

        var hall = new Hall
        {
            Name = request.Name.Trim(),
            ContactPhone = request.ContactPhone.Trim(),
            Region = region,
            Address = request.Address.Trim(),
            Description = request.Description.Trim(),
            Capacity = request.Capacity,
            Price = request.Price,
            ShowPrice = request.Price.HasValue,
            OwnerId = ownerId,
            Status = HallStatus.PendingReview,
            IsDeleted = false
        };

        await using var transaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            hall.BookingPeriods = new List<HallBookingPeriod>
            {
                new HallBookingPeriod { HallId = hall.Id, Type = BookingPeriodType.FirstPeriod, StartTime = request.FirstPeriodStart, EndTime = request.FirstPeriodEnd },
                new HallBookingPeriod { HallId = hall.Id, Type = BookingPeriodType.SecondPeriod, StartTime = request.SecondPeriodStart, EndTime = request.SecondPeriodEnd }
            };

            var images = new List<HallImage>();
            var uploadsRoot = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads", "halls", hall.Id.ToString());
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
            if (images.Count > 0)
                hall.MainImageUrl = images[0].Url;

            await _hallRepository.AddAsync(hall, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            await transaction.CommitAsync(cancellationToken);

            return new CreateHallResponse
            {
                HallId = hall.Id,
                Name = hall.Name,
                ContactPhone = hall.ContactPhone!,
                Region = hall.Region,
                Address = hall.Address,
                Description = hall.Description!,
                Capacity = hall.Capacity,
                Price = hall.Price,
                Status = hall.Status,
                BookingPeriods = hall.BookingPeriods.Select(p => new HallBookingPeriodDto { Type = p.Type, StartTime = p.StartTime, EndTime = p.EndTime }).ToList(),
                Images = images.Select(i => new HallImageDto { Id = i.Id, Url = i.Url }).ToList()
            };
        }
        catch (ValidationException)
        {
            await transaction.RollbackAsync(cancellationToken);
            // Clean up any files written
            try
            {
                var uploadsRoot = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads", "halls", hall.Id.ToString());
                if (Directory.Exists(uploadsRoot))
                    Directory.Delete(uploadsRoot, true);
            }
            catch { }
            throw;
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            try
            {
                var uploadsRoot = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads", "halls", hall.Id.ToString());
                if (Directory.Exists(uploadsRoot))
                    Directory.Delete(uploadsRoot, true);
            }
            catch { }
            throw;
        }
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
