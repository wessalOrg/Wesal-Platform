using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Bookings;

public class BookingRequestService : IBookingRequestService
{
    private readonly IHallRepository _hallRepository;
    private readonly ICurrentUserService _currentUser;

    public BookingRequestService(IHallRepository hallRepository, ICurrentUserService currentUser)
    {
        _hallRepository = hallRepository;
        _currentUser = currentUser;
    }

    public async Task<BookingRequestValidationResultDto> ValidateBookingRequestAsync(
        BookingRequestDto request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to submit a booking request.");
        }

        var hall = await _hallRepository.GetHallByIdAsync(request.HallId, cancellationToken);

        if (hall is null || hall.IsDeleted || hall.Status != HallStatus.Approved)
        {
            throw new NotFoundException(nameof(Hall), request.HallId);
        }

        return new BookingRequestValidationResultDto
        {
            HallId = hall.Id,
            HallName = hall.Name,
            Date = request.Date,
            Periods = request.Periods
        };
    }
}
