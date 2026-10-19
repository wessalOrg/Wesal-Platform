using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

public interface IProfessionalOfferRepository
{
    Task AddAsync(ProfessionalOffer offer, CancellationToken cancellationToken = default);
    void AddImage(ProfessionalOfferImage image);
    Task<ProfessionalOffer?> GetForUpdateAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ProfessionalOffer?> GetAccessibleAsync(Guid id, string? ownerId, DateTimeOffset now, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ProfessionalOffer>> ListOwnAsync(string ownerId, int skip, int take, CancellationToken cancellationToken = default);
    Task<int> CountOwnAsync(string ownerId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ProfessionalOffer>> ListVisibleByOwnerAsync(string ownerId, DateTimeOffset now, int skip, int take, CancellationToken cancellationToken = default);
    Task<int> CountVisibleByOwnerAsync(string ownerId, DateTimeOffset now, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ProfessionalOffer>> GetReminderCandidatesAsync(DateTimeOffset now, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ProfessionalOffer>> GetExpiryCandidatesAsync(DateTimeOffset now, CancellationToken cancellationToken = default);
    Task<bool> TryClaimReminderAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken = default);
    Task<bool> TryClaimExpiryAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken = default);
}
