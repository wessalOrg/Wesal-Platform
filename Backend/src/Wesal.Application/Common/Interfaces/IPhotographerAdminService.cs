using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Administrator-only reads of a photographer's setup submission (WESAL photographer
/// setup). Deliberately minimal: enough for an administrator to verify the submitted
/// personal ID document, without the full review workflow (Tasks 5/6).
/// </summary>
public interface IPhotographerAdminService
{
    /// <summary>
    /// Streams the photographer's personal ID document for the given user id. Only an
    /// administrator reaches this service (controller policy), and only a user who
    /// actually has a photographer setup submission can return a document.
    /// </summary>
    Task<StoredDocument> GetPhotographerIdentityDocumentAsync(
        string userId,
        CancellationToken cancellationToken = default);
}
