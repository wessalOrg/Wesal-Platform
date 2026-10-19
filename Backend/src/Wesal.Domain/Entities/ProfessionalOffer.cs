using Wesal.Domain.Common;

namespace Wesal.Domain.Entities;

public sealed class ProfessionalOffer : BaseAuditableEntity
{
    public string OwnerUserId { get; set; } = string.Empty;
    public string? Content { get; set; }
    public decimal OldPrice { get; set; }
    public decimal OfferPrice { get; set; }
    public decimal? PriceBox { get; set; }
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset EndsAt { get; set; }
    public DateTimeOffset? StoppedAt { get; set; }
    public DateTimeOffset? ReminderSentAt { get; set; }
    public DateTimeOffset? ExpiredProcessedAt { get; set; }
    public bool ReminderEligible { get; set; }
    public bool HasBeenEdited { get; set; }
    public ICollection<ProfessionalOfferImage> Images { get; set; } = [];
}
