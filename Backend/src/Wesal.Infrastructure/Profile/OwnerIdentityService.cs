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
/// <see cref="Wesal.Infrastructure.Halls.HallCreationService"/>). Documents are written
/// to a durable private store (never the public media root) and are only ever read back
/// as bytes served through the authenticated endpoints — there is no public URL for
/// them. The acting user's identity is resolved exclusively from the authenticated
/// session, so an owner can never upload or read another owner's document.
/// </summary>
public sealed class OwnerIdentityService : IOwnerIdentityService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ICurrentUserService _currentUser;
    private readonly IIdentityDocumentStore _store;

    public OwnerIdentityService(
        UserManager<ApplicationUser> userManager,
        ICurrentUserService currentUser,
        IIdentityDocumentStore store)
    {
        _userManager = userManager;
        _currentUser = currentUser;
        _store = store;
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

        var previousUrl = user.IdentityDocumentUrl;
        var previousUploadedAt = user.IdentityDocumentUploadedAt;

        // Persist the bytes first: a record must never point at a document the store
        // rejected (that is precisely the failure mode this flow had when the disk was
        // wiped after every deploy).
        await _store.SaveAsync(relativeUrl, upload.Content, cancellationToken);

        user.IdentityDocumentUrl = relativeUrl;
        user.IdentityDocumentUploadedAt = DateTimeOffset.UtcNow;

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            // Roll back the bytes so a failed save cannot leave an orphaned document.
            await TryDeleteAsync(relativeUrl, cancellationToken);
            user.IdentityDocumentUrl = previousUrl;
            user.IdentityDocumentUploadedAt = previousUploadedAt;
            throw new ValidationException("Could not save the identity document; please try again.");
        }

        // Only remove the replaced document once the new one is durably recorded.
        await TryDeleteAsync(previousUrl, cancellationToken);

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

        var stored = await _store.ReadAsync(user.IdentityDocumentUrl, cancellationToken);

        if (stored is null)
        {
            throw new NotFoundException("The identity document was not found.");
        }

        return new StoredDocument
        {
            RelativeUrl = user.IdentityDocumentUrl,
            FullPath = stored.LocalPath ?? string.Empty,
            Content = stored.Bytes,
            ContentType = DocumentPath.ContentTypeFromUrl(user.IdentityDocumentUrl),
            FileName = DocumentPath.FileNameFromUrl(user.IdentityDocumentUrl) ?? user.IdentityDocumentUrl
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

    private async Task TryDeleteAsync(string? relativeUrl, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(relativeUrl))
        {
            return;
        }

        try
        {
            await _store.DeleteAsync(relativeUrl, cancellationToken);
        }
        catch
        {
            // Best-effort cleanup; an orphaned document is harmless (never served publicly).
        }
    }
}