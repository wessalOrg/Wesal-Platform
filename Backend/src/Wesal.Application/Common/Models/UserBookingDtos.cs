using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

/// <summary>
/// One booking shown to the requester in their own "My bookings" list. Each entry is a
/// persisted Booking containing one or more hourly slots on a single date for a single
/// hall. The list carries every status — Pending, Accepted, Rejected, and Cancelled — so
/// the seeker keeps a complete history, and the hall name is resolved server-side. It
/// never carries another user's data: the requester is fixed to the authenticated
/// session by the service, not supplied by the client.
/// </summary>
public sealed class UserBookingDto
{
    public Guid BookingId { get; init; }

    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public DateOnly Date { get; init; }

    /// <summary>The hourly slot starts this booking holds, ordered ascending.</summary>
    public IReadOnlyList<TimeOnly> SlotStarts { get; init; } = [];

    /// <summary>The booking's time range, e.g. "10:00 - 12:00". Empty when it has no slots.</summary>
    public string TimeRange { get; init; } = string.Empty;

    public BookingStatus Status { get; init; }

    /// <summary>
    /// The deposit the owner required when approving. Null while the request is still
    /// Pending, because the amount does not exist until approval.
    /// </summary>
    public decimal? DepositAmount { get; init; }

    /// <summary>
    /// When the owner confirmed receiving the deposit, or null while it is outstanding.
    /// Non-null means the hours are officially booked and the request can no longer be
    /// cancelled.
    /// </summary>
    public DateTimeOffset? DepositPaymentConfirmedAt { get; init; }

    /// <summary>The owner's rejection reason when the request was rejected, otherwise null.</summary>
    public string? RejectionReason { get; init; }

    public DateTimeOffset RequestedAt { get; init; }
}
