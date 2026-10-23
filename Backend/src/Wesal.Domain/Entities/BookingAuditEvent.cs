namespace Wesal.Domain.Entities;

/// <summary>Append-only external-booking history; snapshots include the original hourly slots.</summary>
public sealed class BookingAuditEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid BookingId { get; set; }
    public Booking Booking { get; set; } = null!;
    public long Revision { get; set; }
    public string Operation { get; set; } = "";
    public string ActorUserId { get; set; } = "";
    public DateTimeOffset OccurredAt { get; set; }
    public string? BeforeJson { get; set; }
    public string AfterJson { get; set; } = "";
}
