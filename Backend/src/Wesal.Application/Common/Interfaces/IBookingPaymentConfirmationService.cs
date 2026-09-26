using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// WESAL-TASK-8 (Edit 8): the owner's confirmation that the deposit (عربون) was actually
/// received. This is the single step that officially books a booking: it stamps
/// <c>DepositPaymentConfirmedAt</c> and promotes the booking's hours from Reserved to
/// Booked in the same transaction, so a requester is never told the hall is booked for
/// them until the money is in the owner's hands.
///
/// Ownership is enforced from the authenticated session against the persisted hall owner
/// id, so one owner can never confirm another owner's booking.
/// </summary>
public interface IBookingPaymentConfirmationService
{
    /// <summary>
    /// Confirms the deposit for an approved booking and books its hours. Throws
    /// UnauthorizedException without a valid owner session, ForbiddenException when the
    /// caller does not own the hall, NotFoundException when the booking is missing, and
    /// ConflictException when the booking is not an unconfirmed Approved booking.
    /// </summary>
    Task<ConfirmBookingPaymentResultDto> ConfirmPaymentAsync(
        Guid hallId,
        Guid bookingId,
        CancellationToken cancellationToken = default);
}
