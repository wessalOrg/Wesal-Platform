using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

/// <summary>
/// One incoming booking request shown to the authenticated Hall Owner for one of
/// their own halls (US-OWNER-09, FR-BOOK-01). Each entry corresponds to one
/// persisted Booking row: a hall/date/period combination requested by a single
/// Regular User. A user who requested both daily periods therefore appears as two
/// entries (one per period), and two competing requests for the same hall/date/
/// period from different users each appear as their own entry — the list never
/// deduplicates, merges, or drops a request. The requester's display name is
/// resolved server-side from the persisted user profile; the DTO never carries a
/// client-supplied requester identity or name.
/// </summary>
public sealed class OwnerBookingRequestDto
{
    public Guid BookingRequestId { get; init; }

    public Guid HallId { get; init; }

    public DateOnly RequestedDate { get; init; }

    public BookingPeriodType RequestedPeriod { get; init; }

    public string RequesterUserId { get; init; } = string.Empty;

    public string RequesterName { get; init; } = string.Empty;

    public BookingStatus Status { get; init; }

    public DateTimeOffset RequestedAt { get; init; }
}