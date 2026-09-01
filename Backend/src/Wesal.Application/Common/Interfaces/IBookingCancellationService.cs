using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IBookingCancellationService
{
    Task<CancelBookingResultDto> CancelBookingAsync(
        Guid hallId,
        Guid bookingId,
        CancellationToken cancellationToken = default);
}