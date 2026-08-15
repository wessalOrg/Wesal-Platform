using Wesal.Application.Common.Models;

namespace Wesal.Application.Common.Interfaces;

public interface IBookingRequestService
{
    Task<BookingRequestValidationResultDto> ValidateBookingRequestAsync(
        BookingRequestDto request,
        CancellationToken cancellationToken = default);
}
