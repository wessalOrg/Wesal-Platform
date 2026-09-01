using System.Globalization;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Bookings;

public class BookingRequestService : IBookingRequestService
{
    private readonly IHallRepository _hallRepository;
    private readonly IBookingRepository _bookingRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUser;

    public BookingRequestService(
        IHallRepository hallRepository,
        ICurrentUserService currentUser,
        IBookingRepository bookingRepository,
        IUnitOfWork unitOfWork)
    {
        _hallRepository = hallRepository;
        _currentUser = currentUser;
        _bookingRepository = bookingRepository;
        _unitOfWork = unitOfWork;
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

        if (_currentUser.Roles.Contains(ApplicationRoles.HallOwner, StringComparer.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Hall owners cannot book halls.");
        }

        var hall = await EnsureEligibleHallAsync(request.HallId, cancellationToken);

        return new BookingRequestValidationResultDto
        {
            HallId = hall.Id,
            HallName = hall.Name,
            Date = request.Date,
            Periods = request.Periods
        };
    }

    public async Task<BookingRequestResultDto> CreateBookingRequestAsync(
        BookingRequestDto request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var requesterUserId = EnsureAuthenticatedRequester();

        var hall = await EnsureEligibleHallAsync(request.HallId, cancellationToken);

        EnsureNotBookingOwnHall(hall, requesterUserId);

        EnsureFutureBookingDate(request.Date);

        if (request.Periods.Count == 0)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Periods"] = ["At least one booking period must be selected."]
            });
        }

        var configuredPeriods = await EnsureConfiguredBookingPeriodsAsync(hall.Id, request.Periods, cancellationToken);

        IWesalTransaction? transaction = null;

        try
        {
            transaction = await _unitOfWork.BeginTransactionAsync(cancellationToken);

            await ReservePeriodsAsync(hall, request.Date, request.Periods, cancellationToken);

            var bookings = await PersistRequestedBookingsAsync(hall, request.Date, requesterUserId, request.Periods, cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            await transaction.CommitAsync(cancellationToken);

            return MapToResult(hall, request.Date, requesterUserId, bookings);
        }
        catch
        {
            if (transaction is not null)
            {
                await transaction.RollbackAsync(cancellationToken);
            }

            throw;
        }
        finally
        {
            if (transaction is not null)
            {
                await transaction.DisposeAsync();
            }
        }
    }

    private string EnsureAuthenticatedRequester()
    {
        if (!_currentUser.IsAuthenticated || string.IsNullOrWhiteSpace(_currentUser.UserId))
        {
            throw new UnauthorizedException("You must be logged in to submit a booking request.");
        }

        if (_currentUser.Roles.Contains(ApplicationRoles.HallOwner, StringComparer.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Hall owners cannot book halls.");
        }

        if (!_currentUser.Roles.Contains(ApplicationRoles.RegisteredUser, StringComparer.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Only regular users can submit booking requests.");
        }

        return _currentUser.UserId;
    }

    private async Task<Hall> EnsureEligibleHallAsync(Guid hallId, CancellationToken cancellationToken)
    {
        var hall = await _hallRepository.GetHallByIdAsync(hallId, cancellationToken);

        if (hall is null || hall.IsDeleted || hall.Status != HallStatus.Approved)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        return hall;
    }

    private static void EnsureNotBookingOwnHall(Hall hall, string requesterUserId)
    {
        if (!string.IsNullOrWhiteSpace(hall.OwnerId)
            && string.Equals(hall.OwnerId, requesterUserId, StringComparison.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Hall owners cannot book their own hall.");
        }
    }

    private static void EnsureFutureBookingDate(DateOnly date)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        if (date <= today)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Date"] = ["The booking date must be in the future."]
            });
        }
    }

    private async Task<IReadOnlyList<HallBookingPeriod>> EnsureConfiguredBookingPeriodsAsync(
        Guid hallId,
        IReadOnlyList<BookingPeriodType> requestedPeriods,
        CancellationToken cancellationToken)
    {
        var configuredPeriods = await _hallRepository.GetBookingPeriodsAsync([hallId], cancellationToken);

        var configuredTypes = configuredPeriods.Select(period => period.Type).ToHashSet();

        foreach (var period in requestedPeriods.Distinct())
        {
            if (!configuredTypes.Contains(period))
            {
                throw new ValidationException(new Dictionary<string, string[]>
                {
                    ["Periods"] = [$"The {period} period is not available at this hall."]
                });
            }
        }

        return configuredPeriods;
    }

    private async Task ReservePeriodsAsync(
        Hall hall,
        DateOnly date,
        IReadOnlyList<BookingPeriodType> periods,
        CancellationToken cancellationToken)
    {
        foreach (var period in periods.Distinct())
        {
            var reservedRows = await _bookingRepository.ReservePeriodAsync(hall.Id, date, period, cancellationToken);

            if (reservedRows == 0)
            {
                var requestedDate = date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

                throw new ConflictException(
                    $"The {period} period on {requestedDate} is no longer available for {hall.Name}.");
            }
        }
    }

    private async Task<List<Booking>> PersistRequestedBookingsAsync(
        Hall hall,
        DateOnly date,
        string requesterUserId,
        IReadOnlyList<BookingPeriodType> periods,
        CancellationToken cancellationToken)
    {
        var bookings = new List<Booking>();

        foreach (var period in periods.Distinct())
        {
            var booking = new Booking
            {
                HallId = hall.Id,
                RequesterUserId = requesterUserId,
                Date = date,
                Period = period,
                Status = BookingStatus.Pending
            };

            await _bookingRepository.AddAsync(booking, cancellationToken);

            bookings.Add(booking);
        }

        return bookings;
    }

    private static BookingRequestResultDto MapToResult(
        Hall hall,
        DateOnly date,
        string requesterUserId,
        List<Booking> bookings)
        => new()
        {
            HallId = hall.Id,
            HallName = hall.Name,
            Date = date,
            RequesterUserId = requesterUserId,
            Status = BookingStatus.Pending,
            Periods = bookings
                .Select(booking => new CreatedBookingDto
                {
                    BookingId = booking.Id,
                    Period = booking.Period,
                    Status = booking.Status
                })
                .ToList()
        };
}