using Wesal.Domain.Common;

namespace Wesal.Domain.Entities;

public sealed class ProfessionalOfferImage : BaseEntity
{
    public Guid OfferId { get; set; }
    public ProfessionalOffer Offer { get; set; } = null!;
    public int Order { get; set; }
    public string StorageKey { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
}
