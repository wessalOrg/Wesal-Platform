using System.Globalization;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.OwnerDashboard;

namespace Wesal.Infrastructure.Bookings;

public class BookingRequestService : IBookingRequestService
{
    private readonly IHallRepository _hallRepository;
    private readonly IBookingRepository _bookingRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUser;
    private readonly IOwnerBookingRequestNotifier _ownerNotifier;

    public BookingRequestService(
        IHallRepository hallRepository,
        ICurrentUserService currentUser,
        IBookingRepository bookingRepository,
        IUnitOfWork unitOfWork,
        IOwnerBookingRequestNotifier ownerNotifier)
    {
        _hallRepository = hallRepository;
        _currentUser = currentUser;
        _bookingRepository = bookingRepository;
        _unitOfWork = unitOfWork;
        _ownerNotifier = ownerNotifier;
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

        // WESAL-TASK-1 hardening: the pre-flight check must agree with the create path, or
        // it would tell a seeker "valid" for a day the owner blocked and only fail later.
        await EnsureDayIsOpenAsync(hall.Id, request.Date, cancellationToken);

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

        var bookings = await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            // WESAL-TASK-1 hardening (day-block gate + atomicity): a day the owner blocked
            // must be unbookable through the legacy endpoint exactly as it is through the
            // hourly one. The check lives INSIDE the transaction that performs the
            // reservation and the insert, so no booking can slip between the check and the
            // write. The exception is the same ConflictException, with the same message,
            // that HourlySlotService.CreateHourlyBookingAsync raises for a blocked day.
            await EnsureDayIsOpenAsync(hall.Id, request.Date, cancellationToken);

            await ReservePeriodsAsync(hall, request.Date, request.Periods, cancellationToken);

            var createdBookings = await PersistRequestedBookingsAsync(
                hall,
                request.Date,
                requesterUserId,
                request.NameOnBooking,
                request.Periods,
                cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return createdBookings;
        }, cancellationToken);

        await NotifyOwnerAsync(hall, request.Date, requesterUserId, bookings, cancellationToken);

        return MapToResult(hall, request.Date, requesterUserId, bookings);
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

    /// <summary>
    /// WESAL-TASK-1 hardening: rejects a booking whose day the owner has blocked.
    ///
    /// The day gate (<see cref="HallDayAvailability"/>) is the hourly model's whole-day
    /// switch, and it is authoritative for the hall regardless of which booking shape the
    /// seeker used. Before this check existed the legacy two-period endpoint ignored the
    /// gate entirely, so an owner could close a day and a seeker could still book it by
    /// calling POST /api/v1/bookings instead of the hourly endpoint.
    ///
    /// The exception type and wording intentionally match
    /// HourlySlotService.CreateHourlyBookingAsync so both paths reject a blocked day in
    /// exactly the same way.
    /// </summary>
    private async Task EnsureDayIsOpenAsync(Guid hallId, DateOnly date, CancellationToken cancellationToken)
    {
        if (!await _bookingRepository.IsDayOpenAsync(hallId, date, cancellationToken))
        {
            throw new ConflictException(
                $"The hall is not available on {date:yyyy-MM-dd} (the day is blocked). Please choose another day.");
        }
    }

    private async Task<Hall> EnsureEligibleHallAsync(Guid hallId, CancellationToken cancellationToken)
    {
        var hall = await _hallRepository.GetHallByIdAsync(hallId, cancellationToken);

        if (hall is null || hall.IsDeleted || hall.Status != HallStatus.Approved)
        {
            throw new NotFoundException(nameof(Hall), hallId);
        }

        // A locked hall (Admin lock, FR-SUB-05/US-ADMIN-05, or the automatic system
        // lock, FR-SUB-03/US-ADMIN-09) must not accept new booking requests, with a
        // clear 'hall locked' error surfaced to the requester.
        HallManagementAccess.EnsureAcceptingBookings(hall);

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
        string nameOnBooking,
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
                // WESAL-TASK-1 hardening: the seeker's own name for this booking is now
                // persisted on the legacy path too, as it already was on the hourly path.
                NameOnBooking = nameOnBooking,
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

    private async Task NotifyOwnerAsync(
        Hall hall,
        DateOnly date,
        string requesterUserId,
        IReadOnlyList<Booking> bookings,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(hall.OwnerId))
        {
            return;
        }

        try
        {
            foreach (var booking in bookings)
            {
                await _ownerNotifier.NotifyBookingRequestReceivedAsync(
                    hall.OwnerId,
                    new OwnerBookingRequestNotificationEvent
                    {
                        BookingRequestId = booking.Id,
                        HallId = hall.Id,
                        HallName = hall.Name,
                        RequestedDate = date,
                        RequestedPeriod = booking.Period,
                        RequesterUserId = requesterUserId,
                        RequesterName = _currentUser.UserName ?? string.Empty,
                        OccurredAt = booking.CreatedAt
                    },
                    cancellationToken);
            }
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception)
        {
            // Best-effort delivery: booking is already persisted and accessible via US-OWNER-09.
        }
    }
}