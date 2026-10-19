using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IAdminModerationService
{
    Task<AdminActionResult> DeletePostAsync(Guid postId, string reason, CancellationToken cancellationToken = default);
    Task<AdminActionResult> DeleteProfessionalOfferAsync(Guid offerId, string reason, CancellationToken cancellationToken = default);
    Task<AccountLockStatusResponse> LockAccountAsync(string userId, CreateAccountLockRequest request, CancellationToken cancellationToken = default);
    Task<AccountLockStatusResponse> UnlockAccountAsync(string userId, CancellationToken cancellationToken = default);
    Task<AccountLockStatusResponse> GetAccountLockAsync(string userId, CancellationToken cancellationToken = default);
    Task<PagedResult<AdminLockedAccountDto>> GetLockedAccountsAsync(string role, string? search, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<PagedResult<AdminModeratedContentDto>> ListAdminPostsAsync(string? ownerId, string? ownerRole, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<AdminModeratedContentDto> GetAdminPostAsync(Guid postId, CancellationToken cancellationToken = default);
    Task<StoredDocument> GetAdminPostImageAsync(Guid postId, Guid imageId, CancellationToken cancellationToken = default);
    Task<PagedResult<AdminModeratedContentDto>> ListAdminOffersAsync(string? ownerId, string? ownerRole, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<AdminModeratedContentDto> GetAdminOfferAsync(Guid offerId, CancellationToken cancellationToken = default);
    Task<StoredDocument> GetAdminOfferImageAsync(Guid offerId, Guid imageId, CancellationToken cancellationToken = default);
}
