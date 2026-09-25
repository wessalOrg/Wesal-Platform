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
/// Seeker-facing hourly-slot availability and booking (WESAL-TASK-1). This is the only
/// booking flow; the old two-period model has been removed. Slot availability is a
/// 60-minute grid derived from the hall's
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

        var slotStarts = EnsureSlotsWithinWindow(hall, request.SlotStarts);

        var booking = await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            // WESAL-TASK-1 hardening (atomicity): the day-gate check now runs inside the
            // same transaction as the slot reservation and the booking insert, so an owner
            // closing the day concurrently can no longer interleave between the two and
            // leave a booking on a day that reports as blocked.
            if (!await _bookingRepository.IsDayOpenAsync(hall.Id, request.Date, cancellationToken))
            {
                throw new ConflictException(
                    $"The hall is not available on {request.Date:yyyy-MM-dd} (the day is blocked). Please choose another day.");
            }

            // All requested hours are reserved together. A partial result means at least
            // one hour was already taken, so the whole booking is refused and the
            // transaction rolls back the hours taken earlier in the loop.
            var reserved = await _bookingRepository.ReserveHourlySlotsAsync(
                hall.Id,
                request.Date,
                slotStarts,
                cancellationToken);

            if (reserved != slotStarts.Count)
            {
                var requestedDate = request.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

                var requestedTimes = string.Join(
                    ", ",
                    slotStarts.Select(start => start.ToString("HH:mm", CultureInfo.InvariantCulture)));

                throw new ConflictException(
                    $"The {requestedTimes} slot(s) on {requestedDate} are already booked. Please choose another slot.");
            }

            var created = new Booking
            {
                HallId = hall.Id,
                RequesterUserId = requesterUserId,
                Date = request.Date,
                NameOnBooking = request.NameOnBooking,
                Status = BookingStatus.Pending,
                Slots = slotStarts
                    .Select(start => new BookingSlot
                    {
                        StartTime = start,
                        EndTime = start.AddHours(1)
                    })
                    .ToList()
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
            SlotStarts = slotStarts,
            TimeRange = booking.HourlyTimeRange,
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

    /// <summary>
    /// Validates the requested hours and returns them de-duplicated and ordered. Every
    /// hour must sit on the hour and fall inside the hall's bookable window. A booking
    /// may cover one hour or several of them, so a repeated start is collapsed rather
    /// than treated as a second reservation of the same hour.
    /// </summary>
    private static IReadOnlyList<TimeOnly> EnsureSlotsWithinWindow(Hall hall, IReadOnlyList<TimeOnly> requested)
    {
        if (requested.Count == 0)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["SlotStarts"] = ["Select at least one hourly slot to book."]
            });
        }

        var start = hall.HourlySlotStart ?? new TimeOnly(9, 0);
        var end = hall.HourlySlotEnd ?? new TimeOnly(22, 0);

        var slotStarts = requested.Distinct().OrderBy(slot => slot).ToList();

        foreach (var slotStart in slotStarts)
        {
            if (slotStart.Minute != 0)
            {
                throw new ValidationException(new Dictionary<string, string[]>
                {
                    ["SlotStarts"] = ["Hourly slots are 60 minutes and must start on the hour (minutes == 00), e.g. 10:00."]
                });
            }

            if (slotStart < start || slotStart >= end)
            {
                throw new ValidationException(new Dictionary<string, string[]>
                {
                    ["SlotStarts"] = [$"The selected slot is outside this hall's bookable hours ({start:HH\\:mm} - {end:HH\\:mm})."]
                });
            }
        }

        return slotStarts;
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
