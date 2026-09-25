using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Constants;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Bookings;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Seeker hourly-slot flow regression tests (WESAL-TASK-1). These exercise the real
/// <see cref="HourlySlotService"/> against in-memory fakes so the day-open gate, the
/// ShowBookedSlots hide-when-OFF behavior, the atomic slot reservation and the
/// explicit 'already booked' rejection are all covered.
/// </summary>
public class HourlySlotServiceShould
{
    private static readonly TimeOnly WindowStart = new(9, 0);
    private static readonly TimeOnly WindowEnd = new(22, 0);

    [Fact]
    public async Task GetHourlyCatalogAsync_ShowBookedSlotsOff_OmitsBookedSlots()
    {
        var hall = CreateHall("Approved Hall", showBookedSlots: false);
        var hallRepository = new FakeHallRepository();
        hallRepository.Halls.Add(hall);
        var bookingRepository = new FakeBookingRepository();
        var date = Tomorrow();
        // 10:00 is already booked; with ShowBookedSlots OFF it must not be returned.
        bookingRepository.Slots.Add(NewSlot(hall.Id, date, new TimeOnly(10, 0), HallSlotStatus.Booked));

        var service = CreateService(hallRepository, bookingRepository);

        var catalog = await service.GetHourlyCatalogAsync(hall.Id, date);

        Assert.True(catalog.DayOpen);
        Assert.DoesNotContain(catalog.Slots, slot => slot.StartTime == new TimeOnly(10, 0));
        Assert.Contains(catalog.Slots, slot => slot.StartTime == new TimeOnly(11, 0));
        Assert.All(catalog.Slots, slot => Assert.Equal(HallSlotStatus.Available, slot.Status));
    }

    [Fact]
    public async Task GetHourlyCatalogAsync_ShowBookedSlotsOn_IncludesBookedSlotMarkedBooked()
    {
        var hall = CreateHall("Approved Hall", showBookedSlots: true);
        var hallRepository = new FakeHallRepository();
        hallRepository.Halls.Add(hall);
        var bookingRepository = new FakeBookingRepository();
        var date = Tomorrow();
        bookingRepository.Slots.Add(NewSlot(hall.Id, date, new TimeOnly(10, 0), HallSlotStatus.Booked));

        var service = CreateService(hallRepository, bookingRepository);

        var catalog = await service.GetHourlyCatalogAsync(hall.Id, date);

        var booked = Assert.Single(catalog.Slots, slot => slot.StartTime == new TimeOnly(10, 0));
        Assert.Equal(HallSlotStatus.Booked, booked.Status);
        Assert.True(booked.IsBooked);
    }

    [Fact]
    public async Task GetHourlyCatalogAsync_BlockedDay_ReturnsNoSlotsAndClosedGate()
    {
        var hall = CreateHall("Approved Hall", showBookedSlots: true);
        var hallRepository = new FakeHallRepository();
        hallRepository.Halls.Add(hall);
        var bookingRepository = new FakeBookingRepository();
        var date = Tomorrow();
        bookingRepository.DayGates.Add(new HallDayAvailability
        {
            HallId = hall.Id,
            Date = date,
            IsOpen = false
        });

        var service = CreateService(hallRepository, bookingRepository);

        var catalog = await service.GetHourlyCatalogAsync(hall.Id, date);

        Assert.False(catalog.DayOpen);
        Assert.Empty(catalog.Slots);
    }

    [Fact]
    public async Task CreateHourlyBookingAsync_BlockedDay_ThrowsExplicitConflict()
    {
        var hall = CreateHall("Approved Hall", showBookedSlots: true);
        var hallRepository = new FakeHallRepository();
        hallRepository.Halls.Add(hall);
        var bookingRepository = new FakeBookingRepository();
        var date = Tomorrow();
        bookingRepository.DayGates.Add(new HallDayAvailability
        {
            HallId = hall.Id,
            Date = date,
            IsOpen = false
        });

        var service = CreateService(hallRepository, bookingRepository, registeredUser: true);

        var exception = await Assert.ThrowsAsync<ConflictException>(() =>
            service.CreateHourlyBookingAsync(CreateRequest(hall.Id, date, new TimeOnly(10, 0))));

        Assert.Contains("blocked", exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(bookingRepository.AddedBookings);
    }

    [Fact]
    public async Task CreateHourlyBookingAsync_AlreadyBookedSlot_ThrowsExplicitConflict()
    {
        var hall = CreateHall("Approved Hall", showBookedSlots: true);
        var hallRepository = new FakeHallRepository();
        hallRepository.Halls.Add(hall);
        var bookingRepository = new FakeBookingRepository();
        var date = Tomorrow();
        bookingRepository.Slots.Add(NewSlot(hall.Id, date, new TimeOnly(10, 0), HallSlotStatus.Booked));

        var service = CreateService(hallRepository, bookingRepository, registeredUser: true);

        var exception = await Assert.ThrowsAsync<ConflictException>(() =>
            service.CreateHourlyBookingAsync(CreateRequest(hall.Id, date, new TimeOnly(10, 0))));

        Assert.Contains("already booked", exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(bookingRepository.AddedBookings);
    }

    [Fact]
    public async Task CreateHourlyBookingAsync_HiddenBookedSlot_WhenShowBookedSlotsOff_StillThrowsExplicitConflict()
    {
        var hall = CreateHall("Approved Hall", showBookedSlots: false);
        var hallRepository = new FakeHallRepository();
        hallRepository.Halls.Add(hall);
        var bookingRepository = new FakeBookingRepository();
        var date = Tomorrow();
        // The slot is booked, and the catalog hides it (ShowBookedSlots OFF), yet a
        // direct booking attempt must still get the explicit rejection.
        bookingRepository.Slots.Add(NewSlot(hall.Id, date, new TimeOnly(10, 0), HallSlotStatus.Booked));

        var service = CreateService(hallRepository, bookingRepository, registeredUser: true);

        var exception = await Assert.ThrowsAsync<ConflictException>(() =>
            service.CreateHourlyBookingAsync(CreateRequest(hall.Id, date, new TimeOnly(10, 0))));

        Assert.Contains("already booked", exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(bookingRepository.AddedBookings);
    }

    [Fact]
    public async Task CreateHourlyBookingAsync_ValidSlot_PersistsSlotStartAndNameOnBooking()
    {
        var hall = CreateHall("Approved Hall", showBookedSlots: true);
        var hallRepository = new FakeHallRepository();
        hallRepository.Halls.Add(hall);
        var bookingRepository = new FakeBookingRepository();
        var date = Tomorrow();

        var service = CreateService(hallRepository, bookingRepository, registeredUser: true);

        var result = await service.CreateHourlyBookingAsync(
            CreateRequest(hall.Id, date, new TimeOnly(10, 0), "Layla Hassan"));

        var booking = Assert.Single(bookingRepository.AddedBookings);
        Assert.Equal(hall.Id, booking.HallId);
        Assert.Equal(date, booking.Date);
        Assert.Equal(new TimeOnly(10, 0), Assert.Single(booking.Slots).StartTime);
        Assert.Equal("Layla Hassan", booking.NameOnBooking);
        Assert.Equal(BookingStatus.Pending, booking.Status);
        Assert.Equal(booking.Id, result.BookingId);
        Assert.Equal(new TimeOnly(10, 0), Assert.Single(result.SlotStarts));
        // The atomic reservation marked the slot booked.
        Assert.Equal(HallSlotStatus.Booked, Assert.Single(bookingRepository.Slots).Status);
    }

    [Fact]
    public async Task CreateHourlyBookingAsync_SlotOutsideWindow_ThrowsValidation()
    {
        var hall = CreateHall("Approved Hall", showBookedSlots: true);
        var hallRepository = new FakeHallRepository();
        hallRepository.Halls.Add(hall);
        var bookingRepository = new FakeBookingRepository();
        var date = Tomorrow();

        var service = CreateService(hallRepository, bookingRepository, registeredUser: true);

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.CreateHourlyBookingAsync(CreateRequest(hall.Id, date, new TimeOnly(23, 0))));

        Assert.Empty(bookingRepository.AddedBookings);
    }

    [Fact]
    public async Task CreateHourlyBookingAsync_UnalignedSlot_ThrowsValidation()
    {
        var hall = CreateHall("Approved Hall", showBookedSlots: true);
        var hallRepository = new FakeHallRepository();
        hallRepository.Halls.Add(hall);
        var bookingRepository = new FakeBookingRepository();
        var date = Tomorrow();

        var service = CreateService(hallRepository, bookingRepository, registeredUser: true);

        await Assert.ThrowsAsync<ValidationException>(() =>
            service.CreateHourlyBookingAsync(CreateRequest(hall.Id, date, new TimeOnly(10, 30))));

        Assert.Empty(bookingRepository.AddedBookings);
    }

    [Fact]
    public async Task GetAvailabilityCalendarAsync_ReturnsOpenByDefaultAndClosedForBlockedDays()
    {
        var hall = CreateHall("Approved Hall", showBookedSlots: true);
        var hallRepository = new FakeHallRepository();
        hallRepository.Halls.Add(hall);
        var bookingRepository = new FakeBookingRepository();
        var from = Tomorrow();
        var to = from.AddDays(2);
        bookingRepository.DayGates.Add(new HallDayAvailability
        {
            HallId = hall.Id,
            Date = from.AddDays(1),
            IsOpen = false
        });

        var service = CreateService(hallRepository, bookingRepository);

        var calendar = await service.GetAvailabilityCalendarAsync(hall.Id, from, to);

        Assert.Equal(3, calendar.Days.Count);
        Assert.True(calendar.Days[0].IsOpen);
        Assert.False(calendar.Days[1].IsOpen);
        Assert.True(calendar.Days[2].IsOpen);
    }

    [Fact]
    public async Task CreateHourlyBookingAsync_Unauthenticated_ThrowsUnauthorized()
    {
        var hall = CreateHall("Approved Hall", showBookedSlots: true);
        var hallRepository = new FakeHallRepository();
        hallRepository.Halls.Add(hall);
        var bookingRepository = new FakeBookingRepository();

        var service = new HourlySlotService(
            hallRepository,
            bookingRepository,
            new FakeUnitOfWork(),
            new FakeCurrentUserService(null, authenticated: false));

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.CreateHourlyBookingAsync(CreateRequest(hall.Id, Tomorrow(), new TimeOnly(10, 0))));
    }

    [Fact]
    public async Task CreateHourlyBookingAsync_GuestRole_ThrowsForbidden()
    {
        var hall = CreateHall("Approved Hall", showBookedSlots: true);
        var hallRepository = new FakeHallRepository();
        hallRepository.Halls.Add(hall);
        var bookingRepository = new FakeBookingRepository();

        // Authenticated but not a RegisteredUser (e.g. the Guest role) -> Forbidden.
        var service = new HourlySlotService(
            hallRepository,
            bookingRepository,
            new FakeUnitOfWork(),
            new FakeCurrentUserService("guest-1", authenticated: true, ApplicationRoles.Guest));

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.CreateHourlyBookingAsync(CreateRequest(hall.Id, Tomorrow(), new TimeOnly(10, 0))));
    }

    private static DateOnly Tomorrow() => DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1));

    private static Hall CreateHall(string name, bool showBookedSlots)
        => new()
        {
            Id = Guid.NewGuid(),
            Name = name,
            Status = HallStatus.Approved,
            OwnerId = "owner-1",
            HourlySlotStart = WindowStart,
            HourlySlotEnd = WindowEnd,
            ShowBookedSlots = showBookedSlots
        };

    private static HallSlotAvailability NewSlot(Guid hallId, DateOnly date, TimeOnly start, HallSlotStatus status)
        => new()
        {
            HallId = hallId,
            Date = date,
            StartTime = start,
            Status = status
        };

    private static HourlyBookingRequestDto CreateRequest(Guid hallId, DateOnly date, TimeOnly slotStart, string name = "Requester")
        => new()
        {
            HallId = hallId,
            Date = date,
            SlotStarts = [slotStart],
            NameOnBooking = name,
            RequesterName = name
        };

    private static HourlySlotService CreateService(
        FakeHallRepository hallRepository,
        FakeBookingRepository bookingRepository,
        bool registeredUser = true)
        => new(
            hallRepository,
            bookingRepository,
            new FakeUnitOfWork(),
            new FakeCurrentUserService("seeker-1", authenticated: true, registeredUser ? ApplicationRoles.RegisteredUser : ApplicationRoles.Guest));

    private sealed class FakeCurrentUserService : ICurrentUserService
    {
        public FakeCurrentUserService(string? userId, bool authenticated, params string[] roles)
        {
            UserId = userId;
            IsAuthenticated = authenticated;
            Roles = roles;
        }

        public string? UserId { get; }

        public string? UserName { get; set; }

        public string? Email => null;

        public bool IsAuthenticated { get; }

        public IReadOnlyList<string> Roles { get; }
    }

    private sealed class FakeUnitOfWork : IUnitOfWork
    {
        public async Task<TResult> ExecuteInTransactionAsync<TResult>(Func<Task<TResult>> operation, CancellationToken cancellationToken = default)
            => await operation();

        public Task ExecuteInTransactionAsync(Func<Task> operation, CancellationToken cancellationToken = default)
        {
            operation();
            return Task.CompletedTask;
        }

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(1);
    }

    private sealed class FakeHallRepository : IHallRepository
    {
        public List<Hall> Halls { get; } = [];

        public Task<Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default)
            => Task.FromResult(Halls.FirstOrDefault(hall => hall.Id == id));

        public Task<IReadOnlyList<Hall>> GetApprovedHallsAsync(int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(Halls.Take(count).ToList());

        public Task<IReadOnlyList<Hall>> GetApprovedHallsByRegionAsync(
            HallRegion region, int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>([]);

        public Task<IReadOnlyList<Hall>> GetApprovedHallsPaginatedAsync(
            int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(Halls.Skip(skip).Take(take).ToList());

        public Task<int> GetApprovedHallsCountAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(Halls.Count);

        public Task<IReadOnlyList<Hall>> SearchApprovedHallsAsync(
            string? name, HallRegion? region, string? area, DateOnly? date, TimeOnly? startTime,
            int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(Halls.Skip(skip).Take(take).ToList());

        public Task<int> SearchApprovedHallsCountAsync(
            string? name, HallRegion? region, string? area, DateOnly? date, TimeOnly? startTime,
            CancellationToken cancellationToken = default)
            => Task.FromResult(Halls.Count);

        public Task<IReadOnlyList<HallImage>> GetHallImagesAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallImage>>([]);

    }

    private sealed class FakeBookingRepository : IBookingRepository
    {
        public List<Booking> AddedBookings { get; } = [];

        public List<HallSlotAvailability> Slots { get; } = [];

        public List<HallDayAvailability> DayGates { get; } = [];

        public Task AddAsync(Booking booking, CancellationToken cancellationToken = default)
        {
            AddedBookings.Add(booking);
            return Task.CompletedTask;
        }

        public Task<Booking?> GetByIdWithHallAsync(Guid bookingId, CancellationToken cancellationToken = default)
            => Task.FromResult<Booking?>(AddedBookings.FirstOrDefault(booking => booking.Id == bookingId));

        public Task<IReadOnlyList<Booking>> GetPendingRejectionNotificationsAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Booking>>([]);

        public Task<int> CancelPendingAsync(Guid bookingId, string requesterUserId, CancellationToken cancellationToken = default)
            => Task.FromResult(0);

        public Task<int> AcceptPendingAsync(Guid bookingId, CancellationToken cancellationToken = default)
            => Task.FromResult(0);

        public Task<int> DeleteAsync(Guid bookingId, CancellationToken cancellationToken = default)
            => Task.FromResult(0);

        // WESAL-TASK-1 hourly-slot methods: implemented in memory so the real service
        // logic (day gate, atomic reserve, ShowBookedSlots filtering) is exercised.

        public Task<bool> IsDayOpenAsync(Guid hallId, DateOnly date, CancellationToken cancellationToken = default)
            => Task.FromResult(DayGates.FirstOrDefault(gate => gate.HallId == hallId && gate.Date == date)?.IsOpen ?? true);

        public Task<IReadOnlyList<HallDayAvailability>> GetDayGatesAsync(
            Guid hallId, DateOnly fromDate, DateOnly toDate, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallDayAvailability>>(
                DayGates.Where(gate => gate.HallId == hallId && gate.Date >= fromDate && gate.Date <= toDate).ToList());

        public Task<IReadOnlyList<HallSlotAvailability>> GetHourlySlotsAsync(
            Guid hallId, DateOnly date, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallSlotAvailability>>(
                Slots.Where(slot => slot.HallId == hallId && slot.Date == date).ToList());

        public Task<int> ReserveHourlySlotsAsync(
            Guid hallId,
            DateOnly date,
            IReadOnlyList<TimeOnly> startTimes,
            CancellationToken cancellationToken = default)
        {
            var reserved = 0;

            foreach (var startTime in startTimes)
            {
                var existing = Slots.FirstOrDefault(slot =>
                    slot.HallId == hallId && slot.Date == date && slot.StartTime == startTime);

                if (existing is null)
                {
                    Slots.Add(NewSlot(hallId, date, startTime, HallSlotStatus.Booked));
                    reserved++;
                    continue;
                }

                if (existing.Status == HallSlotStatus.Booked)
                {
                    break;
                }

                existing.Status = HallSlotStatus.Booked;
                reserved++;
            }

            return Task.FromResult(reserved);
        }
    }
}
