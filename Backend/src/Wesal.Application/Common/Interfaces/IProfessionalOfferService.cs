using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IProfessionalOfferService
{
    Task<Guid> CreateAsync(CreateProfessionalOfferRequest request, CancellationToken cancellationToken = default);
    Task UpdateAsync(Guid offerId, UpdateProfessionalOfferRequest request, CancellationToken cancellationToken = default);
    Task StopAsync(Guid offerId, CancellationToken cancellationToken = default);
    Task<PublicProfileContentDto> GetAsync(Guid offerId, CancellationToken cancellationToken = default);
    Task<PagedResult<PublicProfileContentDto>> ListOwnAsync(int page, int pageSize, CancellationToken cancellationToken = default);
    Task<PagedResult<PublicProfileContentDto>> ListProfileAsync(string userId, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<StoredDocument> GetImageAsync(Guid offerId, Guid imageId, CancellationToken cancellationToken = default);
}
