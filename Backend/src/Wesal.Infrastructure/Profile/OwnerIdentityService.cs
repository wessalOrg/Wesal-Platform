using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Documents;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Profile;

/// <summary>
/// Owner identity-document flow (US-OWNER-30). The owner's identity document is
/// required before the owner can create a hall (backend-enforced by
/// <see cref="Wesal.Infrastructure.Halls.HallCreationService"/>). Uploads are stored in
/// the protected document root (never the public media root) and served only through
/// the authenticated endpoints. The acting user's identity is resolved exclusively from
/// the authenticated session, so an owner can never upload or read another owner's
/// document.
/// </summary>
public sealed class OwnerIdentityService : IOwnerIdentityService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ICurrentUserService _currentUser;
    private readonly IDocumentStorage _storage;

    public OwnerIdentityService(
        UserManager<ApplicationUser> userManager,
        ICurrentUserService currentUser,
        IDocumentStorage storage)
    {
        _userManager = userManager;
        _currentUser = currentUser;
        _storage = storage;
    }

    public async Task<IdentityDocumentUploadResult> UploadIdentityDocumentAsync(
        OwnerDocumentUpload upload,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var user = await ResolveUserAsync(cancellationToken);

        DocumentUploadValidator.EnsureValid(upload);

        var fileName = $"{Guid.NewGuid()}{Path.GetExtension(upload.FileName).ToLowerInvariant()}";
        var relativeUrl = DocumentPath.OwnerIdentityRelativeUrl(user.Id, fileName);

        var directory = _storage.OwnerDocumentsDirectory(user.Id);
        Directory.CreateDirectory(directory);
        await File.WriteAllBytesAsync(Path.Combine(directory, fileName), upload.Content, cancellationToken);

        // Best-effort cleanup of a previous document when replacing it.
        await TryDeletePreviousAsync(user.IdentityDocumentUrl, cancellationToken);

        user.IdentityDocumentUrl = relativeUrl;
        user.IdentityDocumentUploadedAt = DateTimeOffset.UtcNow;

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            throw new ValidationException("Could not save the identity document; please try again.");
        }

        return new IdentityDocumentUploadResult
        {
            UploadedAt = user.IdentityDocumentUploadedAt,
            HasDocument = true
        };
    }

    public async Task<StoredDocument> GetIdentityDocumentAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var user = await ResolveUserAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(user.IdentityDocumentUrl))
        {
            throw new NotFoundException("The owner has not uploaded an identity document yet.");
        }

        var fullPath = DocumentPath.ResolveFullPath(_storage.Root, user.IdentityDocumentUrl);

        if (fullPath is null || !File.Exists(fullPath))
        {
            throw new NotFoundException("The identity document was not found.");
        }

        return new StoredDocument
        {
            RelativeUrl = user.IdentityDocumentUrl,
            FullPath = fullPath,
            ContentType = InferContentType(fullPath),
            FileName = DocumentPath.FileNameFromUrl(user.IdentityDocumentUrl) ?? Path.GetFileName(fullPath)
        };
    }

    private async Task<ApplicationUser> ResolveUserAsync(CancellationToken cancellationToken)
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to manage your identity document.");
        }

        var user = await _userManager.FindByIdAsync(_currentUser.UserId);
        if (user is null)
        {
            throw new NotFoundException("User", _currentUser.UserId);
        }

        return user;
    }

    private async Task TryDeletePreviousAsync(string? previousUrl, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(previousUrl))
        {
            return;
        }

        var previousPath = DocumentPath.ResolveFullPath(_storage.Root, previousUrl);
        if (previousPath is not null && File.Exists(previousPath))
        {
            try
            {
                await Task.Run(() => File.Delete(previousPath), cancellationToken);
            }
            catch
            {
                // Best-effort cleanup; an orphaned file is harmless (never served publicly).
            }
        }
    }

    private static string InferContentType(string fullPath)
    {
        return Path.GetExtension(fullPath).ToLowerInvariant() switch
        {
            ".pdf" => "application/pdf",
            ".png" => "image/png",
            ".webp" => "image/webp",
            _ => "image/jpeg"
        };
    }
}