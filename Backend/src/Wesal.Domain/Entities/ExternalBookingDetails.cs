namespace Wesal.Domain.Entities;

/// <summary>Owner-private information. Never project this entity on public or seeker APIs.</summary>
public sealed class ExternalBookingDetails
{
    public Guid BookingId { get; set; }
    public Booking Booking { get; set; } = null!;
    public string CustomerName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string EventType { get; set; } = "";
    public int? Guests { get; set; }
    public string Notes { get; set; } = "";
    public decimal? TotalAmount { get; set; }
    public decimal? AmountReceivedExternally { get; set; }
    public DateTimeOffset ConfirmedAt { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }
    public string? CancelledBy { get; set; }
    public string? CancellationReason { get; set; }
}
