using System.Globalization;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Bookings;

/// <summary>
/// Seeker-facing hourly-slot availability and booking (WESAL-TASK-1). Additive to the
/// legacy <see cref="BookingRequestService"/> two-period flow, which stays dormant and
/// unchanged. Slot availability is a 60-minute grid derived from the hall's
/// <see cref="Hall.HourlySlotStart"/> / <see cref="Hall.HourlySlotEnd"/> window; the
/// per-day <see cref="HallDayAvailability"/> gate can close a whole day. Booking an
/// already-booked (or hidden) slot, or a fully blocked day, always returns an explicit
/// <see cref="ConflictException"/> and never fails silently.
/// </summary>
public class HourlySlotService : IHourlySlotService
{
    private readonly IHallRepository _hallRepository;
    private readonly IBookingRepository _bookingRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUser;

    public HourlySlotService(
        IHallRepository hallRepository,
        IBookingRepository bookingRepository,
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUser)
    {
        _hallRepository = hallRepository;
        _bookingRepository = bookingRepository;
        _unitOfWork = unitOfWork;
        _currentUser = currentUser;
    }

    public async Task<HallHourlyCatalogDto> GetHourlyCatalogAsync(
        Guid hallId,
        DateOnly date,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var hall = await _hallRepository.GetHallByIdAsync(hallId, cancellationToken)
            ?? throw new NotFoundException(nameof(Hall), hallId);

        var dayOpen = await _bookingRepository.IsDayOpenAsync(hallId, date, cancellationToken);

        if (!dayOpen)
        {
            // A fully blocked day exposes no slots to seekers at all.
            //
            // WESAL-TASK-1 hardening: how the block itself is reported depends on the
            // hall's ShowBookedSlots toggle, because a blocked day is a fully-booked day
            // as far as booking is concerned.
            //   ON  -> the day is disclosed as closed, matching how a fully-booked day reads
            //           when booked time is shown.
            //   OFF -> the block must stay invisible. DayOpen=true with an empty slot list
            //          is exactly the response a fully-booked hidden day produces further
            //          down, so a seeker cannot tell "the owner closed this day" apart from
            //          "someone booked every hour".
            return new HallHourlyCatalogDto
            {
                HallId = hallId,
                Date = date,
                DayOpen = !hall.ShowBookedSlots,
                Slots = []
            };
        }

        var bookedRows = await _bookingRepository.GetHourlySlotsAsync(hallId, date, cancellationToken);

        var bookedStarts = bookedRows
            .Where(row => row.Status == HallSlotStatus.Booked)
            .Select(row => row.StartTime)
            .ToHashSet();

        var slots = new List<HallHourlySlotDto>();

        foreach (var (start, end) in BuildHourlyWindow(hall))
        {
            var isBooked = bookedStarts.Contains(start);

            if (isBooked && !hall.ShowBookedSlots)
            {
                // ShowBookedSlots OFF: booked hours are omitted entirely.
                continue;
            }

            slots.Add(new HallHourlySlotDto
            {
                StartTime = start,
                EndTime = end,
                Status = isBooked ? HallSlotStatus.Booked : HallSlotStatus.Available
            });
        }

        return new HallHourlyCatalogDto
        {
            HallId = hallId,
            Date = date,
            DayOpen = true,
            Slots = slots
        };
    }

    public async Task<HallHourlyCalendarDto> GetAvailabilityCalendarAsync(
        Guid hallId,
        DateOnly fromDate,
        DateOnly toDate,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var hall = await _hallRepository.GetHallByIdAsync(hallId, cancellationToken)
            ?? throw new NotFoundException(nameof(Hall), hallId);

        EnsureValidRange(fromDate, toDate);

        var dayGates = await _bookingRepository.GetDayGatesAsync(hallId, fromDate, toDate, cancellationToken);

        var blockedDates = dayGates
            .Where(day => !day.IsOpen)
            .Select(day => day.Date)
            .ToHashSet();

        var days = new List<HallHourlyCalendarDayDto>();
        for (var date = fromDate; date <= toDate; date = date.AddDays(1))
        {
            // A day with no HallDayAvailability row defaults to Open; only an explicit
            // closed gate marks the day as blocked.
            //
            // WESAL-TASK-1 hardening: the gate is only disclosed to seekers when the hall
            // opts into showing booked days/hours. With ShowBookedSlots OFF a blocked day is
            // reported as an ordinary open day, so the calendar never reveals that the
            // owner closed it; the seeker simply finds no bookable hours for it, exactly as
            // for a day whose hours are all already booked. With the toggle ON the day is
            // correctly surfaced as Closed.
            var isBlocked = blockedDates.Contains(date);

            days.Add(new HallHourlyCalendarDayDto
            {
                Date = date,
                IsOpen = !isBlocked || !hall.ShowBookedSlots
            });
        }

        return new HallHourlyCalendarDto
        {
            HallId = hallId,
            FromDate = fromDate,
            ToDate = toDate,
            Days = days
        };
    }

    public async Task<HourlyBookingResultDto> CreateHourlyBookingAsync(
        HourlyBookingRequestDto request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var requesterUserId = EnsureAuthenticatedRequester();

        var hall = await _hallRepository.GetHallByIdAsync(request.HallId, cancellationToken)
            ?? throw new NotFoundException(nameof(Hall), request.HallId);

        if (hall.IsDeleted || hall.Status != HallStatus.Approved)
        {
            throw new NotFoundException(nameof(Hall), request.HallId);
        }

        HallManagementAccess.EnsureAcceptingBookings(hall);

        EnsureNotBookingOwnHall(hall, requesterUserId);

        EnsureFutureBookingDate(request.Date);

        EnsureSlotWithinWindow(hall, request.SlotStart);

        var booking = await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            // WESAL-TASK-1 hardening (atomicity): the day-gate check now runs inside the
            // same transaction as the slot reservation and the booking insert, so an owner
            // closing the day concurrently can no longer interleave between the two and
            // leave a booking on a day that reports as blocked. The check and the write
            // were previously two separate round-trips outside any shared scope.
            if (!await _bookingRepository.IsDayOpenAsync(hall.Id, request.Date, cancellationToken))
            {
                throw new ConflictException(
                    $"The hall is not available on {request.Date:yyyy-MM-dd} (the day is blocked). Please choose another day.");
            }

            var reserved = await _bookingRepository.ReserveHourlySlotAsync(
                hall.Id,
                request.Date,
                request.SlotStart,
                cancellationToken);

            if (reserved == 0)
            {
                var requestedDate = request.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                var requestedTime = request.SlotStart.ToString("HH:mm", CultureInfo.InvariantCulture);

                throw new ConflictException(
                    $"The {requestedTime} slot on {requestedDate} is already booked. Please choose another slot.");
            }

            var created = new Booking
            {
                HallId = hall.Id,
                RequesterUserId = requesterUserId,
                Date = request.Date,
                SlotStart = request.SlotStart,
                NameOnBooking = request.NameOnBooking,
                Status = BookingStatus.Pending
            };

            await _bookingRepository.AddAsync(created, cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return created;
        }, cancellationToken);

        return new HourlyBookingResultDto
        {
            BookingId = booking.Id,
            HallId = booking.HallId,
            Date = booking.Date,
            SlotStart = booking.SlotStart,
            Status = booking.Status
        };
    }

    private static IEnumerable<(TimeOnly Start, TimeOnly End)> BuildHourlyWindow(Hall hall)
    {
        var start = hall.HourlySlotStart ?? new TimeOnly(9, 0);
        var end = hall.HourlySlotEnd ?? new TimeOnly(22, 0);

        for (var current = start; current < end; current = current.AddHours(1))
        {
            yield return (current, current.AddHours(1));
        }
    }

    private static void EnsureSlotWithinWindow(Hall hall, TimeOnly slotStart)
    {
        var start = hall.HourlySlotStart ?? new TimeOnly(9, 0);
        var end = hall.HourlySlotEnd ?? new TimeOnly(22, 0);

        if (slotStart.Minute != 0)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["SlotStart"] = ["Hourly slots are 60 minutes and must start on the hour (minutes == 00), e.g. 10:00."]
            });
        }

        if (slotStart < start || slotStart >= end)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["SlotStart"] = [$"The selected slot is outside this hall's bookable hours ({start:HH\\:mm} - {end:HH\\:mm})."]
            });
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

    private static void EnsureValidRange(DateOnly fromDate, DateOnly toDate)
    {
        if (toDate < fromDate)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["toDate"] = ["The 'to' date must be on or after the 'from' date."]
            });
        }
    }
}
