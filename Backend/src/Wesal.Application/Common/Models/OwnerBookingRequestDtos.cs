using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

/// <summary>
/// One incoming booking request shown to the authenticated Hall Owner for one of
/// their own halls (US-OWNER-09, FR-BOOK-01). Each entry corresponds to one persisted
/// Booking row containing one or more hourly slots for a hall and date.
/// Competing requests remain separate entries; the list never deduplicates, merges,
/// or drops a request. The requester's display name is resolved server-side from the
/// persisted user profile; the DTO never carries a client-supplied requester identity
/// or name.
/// </summary>
public sealed class OwnerBookingRequestDto
{
    public Guid BookingRequestId { get; init; }

    public Guid HallId { get; init; }

    public DateOnly RequestedDate { get; init; }

    public IReadOnlyList<TimeOnly> SlotStarts { get; init; } = [];

    public string TimeRange { get; init; } = string.Empty;

    public string RequesterUserId { get; init; } = string.Empty;

    public string RequesterName { get; init; } = string.Empty;

    public BookingStatus Status { get; init; }

    public DateTimeOffset RequestedAt { get; init; }

    /// <summary>
    /// WESAL-TASK-8 (Edit 8): the deposit the owner set when approving. Null while the
    /// request is still Pending, because the amount does not exist until approval. This is
    /// what the owner is waiting to receive, and what the requester is expected to pay.
    /// </summary>
    public decimal? DepositAmount { get; init; }

    /// <summary>
    /// WESAL-TASK-8 (Edit 8): when the owner confirmed receiving the deposit, or null while
    /// it is still outstanding. Non-null means the hours are officially Booked and the
    /// booking can no longer be rejected or cancelled.
    /// </summary>
    public DateTimeOffset? DepositPaymentConfirmedAt { get; init; }
}

/// <summary>
/// The authenticated Hall Owner's dedicated bookings calendar for one of their own
/// halls (Edit 25). Unlike the pending-requests list, this covers every actively
/// booked hour in the requested range, grouped by date, so the frontend can render
/// a calendar independently from general hall data without joining other endpoints.
/// Only live bookings (Pending or Accepted) occupy hours; cancelled, rejected, or
/// deleted bookings never appear.
/// </summary>
public sealed class OwnerBookingsCalendarDto
{
    public Guid HallId { get; init; }

    public DateOnly FromDate { get; init; }

    public DateOnly ToDate { get; init; }

    public IReadOnlyList<OwnerBookingsCalendarDayDto> Days { get; init; } = [];
}

/// <summary>
/// One calendar day in <see cref="OwnerBookingsCalendarDto"/>. Days with no booked
/// hours are still returned (with an empty <see cref="BookedHours"/>) so the
/// frontend can render a continuous grid; <see cref="HasBookedHours"/> (Edit 23) is
/// the authoritative per-day indicator and is true exactly when
/// <see cref="BookedHours"/> is non-empty.
/// </summary>
public sealed class OwnerBookingsCalendarDayDto
{
    public DateOnly Date { get; init; }

    /// <summary>
    /// Whether this date contains any booked hours (Edit 23). True exactly when
    /// <see cref="BookedHours"/> is non-empty.
    /// </summary>
    public bool HasBookedHours { get; init; }

    /// <summary>
    /// The booked whole-hour starts for this date (e.g. 09:00, 10:00), ordered
    /// ascending and de-duplicated across all live bookings on the date.
    /// </summary>
    public IReadOnlyList<TimeOnly> BookedHours { get; init; } = [];
}
