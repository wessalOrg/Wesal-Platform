using Wesal.Domain.Enums;

namespace Wesal.Application.Common.Models;

/// <summary>
/// WESAL-TASK-8 (Edit 8): what the Hall Owner sends when approving a booking request.
/// The deposit (عربون) is mandatory, because an approval without one would leave the
/// owner with nothing to collect and no way to decide whether the booking is paid for.
/// A missing or zero amount is rejected instead of being defaulted, so the owner always
/// states the real figure.
/// </summary>
public class AcceptBookingRequestDto
{
    /// <summary>
    /// The deposit the requester must pay, in ILS. Must be greater than zero and at most
    /// 1,000,000, which is the validated range enforced by
    /// <c>AcceptBookingRequestDtoValidator</c>.
    /// </summary>
    public decimal DepositAmount { get; init; }
}

/// <summary>
/// How a lifecycle notice sent to the requester turned out. Mirrors
/// <see cref="BookingRejectionNotificationStatus"/> so approval and rejection report the
/// same way: Delivered when the requester was told, Deferred when the notice is queued
/// for a retry.
/// </summary>
public enum BookingAcceptanceNotificationStatus
{
    Deferred = 0,

    Delivered = 1
}

/// <summary>
/// Result returned after a booking request has been successfully accepted by the
/// Hall Owner (US-OWNER-11).
///
/// WESAL-TASK-8 (Edit 8): acceptance no longer books the hours. It records the required
/// deposit, moves the booking to Accepted, and leaves its hours Reserved. The booking only
/// becomes officially Booked when the owner confirms the deposit was received, so the
/// owner has a second, deliberate step and the requester is told what to pay.
/// </summary>
public class AcceptBookingResultDto
{
    public Guid BookingId { get; init; }

    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public string RequesterUserId { get; init; } = string.Empty;

    public DateOnly Date { get; init; }

    public IReadOnlyList<TimeOnly> SlotStarts { get; init; } = [];

    public string TimeRange { get; init; } = string.Empty;

    public BookingStatus Status { get; init; } = BookingStatus.Accepted;

    /// <summary>The deposit the owner required, echoed back so the client can display it.</summary>
    public decimal? DepositAmount { get; init; }

    /// <summary>
    /// Always null here: the hours are only Reserved at this point and become officially
    /// booked once the owner confirms the deposit.
    /// </summary>
    public DateTimeOffset? DepositPaymentConfirmedAt { get; init; }

    /// <summary>Whether the requester-facing approval notice was sent or is queued.</summary>
    public BookingAcceptanceNotificationStatus NotificationStatus { get; init; }
}

/// <summary>
/// WESAL-TASK-8 (Edit 8): result of the owner confirming the deposit was received. This
/// is the step that officially books the hours, moving them from Reserved to Booked.
/// </summary>
public class ConfirmBookingPaymentResultDto
{
    public Guid BookingId { get; init; }

    public Guid HallId { get; init; }

    public string HallName { get; init; } = string.Empty;

    public string RequesterUserId { get; init; } = string.Empty;

    public DateOnly Date { get; init; }

    public IReadOnlyList<TimeOnly> SlotStarts { get; init; } = [];

    public string TimeRange { get; init; } = string.Empty;

    public BookingStatus Status { get; init; } = BookingStatus.Accepted;

    /// <summary>The deposit that was confirmed as received.</summary>
    public decimal? DepositAmount { get; init; }

    /// <summary>
    /// When the owner confirmed receiving the deposit. From this moment the booking can no
    /// longer be rejected or cancelled, and its hours report as booked.
    /// </summary>
    public DateTimeOffset? DepositPaymentConfirmedAt { get; init; }
}
