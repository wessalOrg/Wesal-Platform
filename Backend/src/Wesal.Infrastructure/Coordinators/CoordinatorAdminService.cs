using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Documents;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Coordinators;

/// <summary>
/// Administrator-only reads of a coordinator's setup submission (WESAL coordinator
/// setup). The identity document is served from the private document store as bytes
/// through this authenticated, authorization-protected path — there is no public URL
/// for it anywhere. A user without a coordinator setup submission returns 404, so the
/// endpoint cannot be used to probe arbitrary accounts.
/// </summary>
public sealed class CoordinatorAdminService : ICoordinatorAdminService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ICoordinatorRepository _coordinatorRepository;
    private readonly IIdentityDocumentStore _documentStore;

    public CoordinatorAdminService(
        UserManager<ApplicationUser> userManager,
        ICoordinatorRepository coordinatorRepository,
        IIdentityDocumentStore documentStore)
    {
        _userManager = userManager;
        _coordinatorRepository = coordinatorRepository;
        _documentStore = documentStore;
    }

    public async Task<StoredDocument> GetCoordinatorIdentityDocumentAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var profile = await _coordinatorRepository.GetByUserIdAsync(userId, cancellationToken);
        if (profile is null)
        {
            throw new NotFoundException("Coordinator", userId);
        }

        // Defensive re-check: the referenced user must still exist.
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
        {
            throw new NotFoundException("User", userId);
        }

        if (string.IsNullOrWhiteSpace(profile.IdentityDocumentUrl))
        {
            throw new NotFoundException("The coordinator has not uploaded an identity document yet.");
        }

        var stored = await _documentStore.ReadAsync(profile.IdentityDocumentUrl, cancellationToken);
        if (stored is null)
        {
            throw new NotFoundException("The coordinator identity document was not found.");
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
