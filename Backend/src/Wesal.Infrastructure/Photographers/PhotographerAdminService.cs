using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Documents;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Photographers;

/// <summary>
/// Administrator-only reads of a photographer's setup submission (WESAL photographer
/// setup). The identity document is served from the private document store as bytes
/// through this authenticated, authorization-protected path — there is no public URL
/// for it anywhere. A user without a photographer setup submission returns 404, so the
/// endpoint cannot be used to probe arbitrary accounts.
/// </summary>
public sealed class PhotographerAdminService : IPhotographerAdminService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IPhotographerRepository _photographerRepository;
    private readonly IIdentityDocumentStore _documentStore;

    public PhotographerAdminService(
        UserManager<ApplicationUser> userManager,
        IPhotographerRepository photographerRepository,
        IIdentityDocumentStore documentStore)
    {
        _userManager = userManager;
        _photographerRepository = photographerRepository;
        _documentStore = documentStore;
    }

    public async Task<StoredDocument> GetPhotographerIdentityDocumentAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var profile = await _photographerRepository.GetByUserIdAsync(userId, cancellationToken);
        if (profile is null)
        {
            throw new NotFoundException("Photographer", userId);
        }

        // Defensive re-check: the referenced user must still exist.
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
        {
            throw new NotFoundException("User", userId);
        }

        if (string.IsNullOrWhiteSpace(profile.IdentityDocumentUrl))
        {
            throw new NotFoundException("The photographer has not uploaded an identity document yet.");
        }

        var stored = await _documentStore.ReadAsync(profile.IdentityDocumentUrl, cancellationToken);
        if (stored is null)
        {
            throw new NotFoundException("The photographer identity document was not found.");
        }

        return new StoredDocument
        {
            RelativeUrl = profile.IdentityDocumentUrl,
            FullPath = stored.LocalPath ?? string.Empty,
            Content = stored.Bytes,
            ContentType = DocumentPath.ContentTypeFromUrl(profile.IdentityDocumentUrl),
            FileName = DocumentPath.FileNameFromUrl(profile.IdentityDocumentUrl) ?? profile.IdentityDocumentUrl
        };
    }
}
