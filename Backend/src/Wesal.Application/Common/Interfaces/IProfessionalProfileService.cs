using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IProfessionalProfileService
{
    Task<PublicProfessionalProfileResponse> GetPublicProfileAsync(string userId, CancellationToken cancellationToken = default);
    Task UpdateBioAsync(UpdatePublicBioRequest request, CancellationToken cancellationToken = default);
    Task<string> UploadProfilePictureAsync(OwnerDocumentUpload upload, CancellationToken cancellationToken = default);
    Task<StoredDocument> GetProfilePictureAsync(string userId, CancellationToken cancellationToken = default);
}
