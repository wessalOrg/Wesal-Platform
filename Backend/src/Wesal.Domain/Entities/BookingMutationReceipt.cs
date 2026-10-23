namespace Wesal.Domain.Entities;

/// <summary>Committed atomically with the booking; retained for lost-response retries.</summary>
public sealed class BookingMutationReceipt
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid HallId { get; set; }
    public string ActorUserId { get; set; } = "";
    public string Operation { get; set; } = "";
    public string Key { get; set; } = "";
    public string RequestHash { get; set; } = "";
    public string ResponseJson { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
}
