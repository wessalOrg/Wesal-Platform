using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IAdminModerationService
{
    Task<AdminActionResult> DeletePostAsync(Guid postId, string reason, CancellationToken cancellationToken = default);
    Task<AdminActionResult> DeleteProfessionalOfferAsync(Guid offerId, string reason, CancellationToken cancellationToken = default);
    Task<PublishingRestrictionStatusResponse> RestrictPublishingAsync(string userId, CreatePublishingRestrictionRequest request, CancellationToken cancellationToken = default);
    Task<PublishingRestrictionStatusResponse> GetRestrictionAsync(string userId, CancellationToken cancellationToken = default);
    Task<AdminActionResult> DeleteAccountAsync(string userId, DeleteAccountRequest request, CancellationToken cancellationToken = default);
}
