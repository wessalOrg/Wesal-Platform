using Wesal.Domain.Entities;

namespace Wesal.Application.Common.Interfaces.Persistence;

public sealed record AccountCleanupSnapshot(IReadOnlyList<string> FileKeys, IReadOnlyList<string> MessageAttachmentUrls, IReadOnlyDictionary<string, int> Counts);

public interface IAdminModerationRepository
{
    Task<Post?> GetPostForModerationAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ProfessionalOffer?> GetOfferForModerationAsync(Guid id, CancellationToken cancellationToken = default);
    void RemovePost(Post post);
    void RemoveOffer(ProfessionalOffer offer);
    Task<AccountCleanupSnapshot> DeleteProfessionalAccountDataAsync(string userId, CancellationToken cancellationToken = default);
}
