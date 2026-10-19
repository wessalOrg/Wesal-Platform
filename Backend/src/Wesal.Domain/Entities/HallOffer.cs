using Wesal.Domain.Common;

namespace Wesal.Domain.Entities;

public sealed class HallOffer : BaseAuditableEntity
{
    public Guid HallId { get; set; }
    public Hall Hall { get; set; } = null!;
    public decimal OldBookingPrice { get; set; }
    public decimal OfferPrice { get; set; }
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset EndsAt { get; set; }
    public DateTimeOffset? StoppedAt { get; set; }
    public DateTimeOffset? ExpiredProcessedAt { get; set; }
}
