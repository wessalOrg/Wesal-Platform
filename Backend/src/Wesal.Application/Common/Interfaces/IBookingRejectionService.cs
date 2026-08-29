using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IBookingRejectionService
{
    Task<RejectBookingResultDto> RejectBookingAsync(
        Guid hallId,
        Guid bookingId,
        RejectBookingRequestDto request,
        CancellationToken cancellationToken = default);

    Task<int> DeliverPendingRejectionNotificationsAsync(CancellationToken cancellationToken = default);
}