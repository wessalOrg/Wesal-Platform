using Wesal.Domain.Entities;
using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IAdminModerationRepository
{
    Task<Post?> GetPostForModerationAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ProfessionalOffer?> GetOfferForModerationAsync(Guid id, CancellationToken cancellationToken = default);
    void RemovePost(Post post);
    void RemoveOffer(ProfessionalOffer offer);
    Task<int> CountLockedAccountsAsync(string role, string? search, DateTimeOffset now, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AdminLockedAccountDto>> ListLockedAccountsAsync(string role, string? search, DateTimeOffset now, int skip, int take, CancellationToken cancellationToken = default);
    Task<int> CountAdminPostsAsync(string? ownerId, string? ownerRole, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AdminModeratedContentDto>> ListAdminPostsAsync(string? ownerId, string? ownerRole, DateTimeOffset now, int skip, int take, CancellationToken cancellationToken = default);
    Task<AdminModeratedContentDto?> GetAdminPostAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken = default);
    Task<int> CountAdminOffersAsync(string? ownerId, string? ownerRole, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AdminModeratedContentDto>> ListAdminOffersAsync(string? ownerId, string? ownerRole, DateTimeOffset now, int skip, int take, CancellationToken cancellationToken = default);
    Task<AdminModeratedContentDto?> GetAdminOfferAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken = default);
}
