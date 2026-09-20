using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Owner identity-document flow (US-OWNER-30): upload and retrieval of the owner's own
/// identity document, required before the owner can create a hall. The owner identity
/// is resolved exclusively from the authenticated session, so an owner can never upload
/// or read another owner's document. Uploaded documents are stored outside the public
/// static-file area and served only through this authenticated endpoint.
/// </summary>
public interface IOwnerIdentityService
{
    Task<IdentityDocumentUploadResult> UploadIdentityDocumentAsync(
        OwnerDocumentUpload upload,
        CancellationToken cancellationToken = default);

    Task<StoredDocument> GetIdentityDocumentAsync(CancellationToken cancellationToken = default);
}