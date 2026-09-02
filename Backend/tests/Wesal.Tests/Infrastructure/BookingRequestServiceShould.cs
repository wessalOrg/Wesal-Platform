using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Bookings;

namespace Wesal.Tests.Infrastructure;

public class BookingRequestServiceShould
{
    [Fact]
    public async Task ValidateBookingRequestAsync_Guest_ThrowsUnauthorized()
    {
        var hall = CreateHall("Approved Hall", HallStatus.Approved);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository, new FakeCurrentUserService(null, authenticated: false));

        var exception = await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.ValidateBookingRequestAsync(CreateRequest(hall.Id)));

        Assert.Contains("logged in", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ValidateBookingRequestAsync_UnknownHall_ThrowsNotFound()
    {
        var fakeRepository = new FakeHallRepository();
        var service = CreateService(fakeRepository, new FakeCurrentUserService("user-1", authenticated: true));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.ValidateBookingRequestAsync(CreateRequest(Guid.NewGuid())));
    }

    [Fact]
    public async Task ValidateBookingRequestAsync_PendingHall_ThrowsNotFound()
    {
        var hall = CreateHall("Pending Hall", HallStatus.PendingReview);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository, new FakeCurrentUserService("user-1", authenticated: true));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.ValidateBookingRequestAsync(CreateRequest(hall.Id)));
    }

    [Fact]
    public async Task ValidateBookingRequestAsync_RejectedHall_ThrowsNotFound()
    {
        var hall = CreateHall("Rejected Hall", HallStatus.Rejected);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository, new FakeCurrentUserService("user-1", authenticated: true));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.ValidateBookingRequestAsync(CreateRequest(hall.Id)));
    }

    [Fact]
    public async Task ValidateBookingRequestAsync_DeletedHall_ThrowsNotFound()
    {
        var hall = CreateHall("Deleted Hall", HallStatus.Approved);
        hall.IsDeleted = true;
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository, new FakeCurrentUserService("user-1", authenticated: true));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.ValidateBookingRequestAsync(CreateRequest(hall.Id)));
    }

    [Fact]
    public async Task ValidateBookingRequestAsync_AuthenticatedUser_ReturnsHallContext()
    {
        var hall = CreateHall("Approved Hall", HallStatus.Approved);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository, new FakeCurrentUserService("user-1", authenticated: true));
        var request = CreateRequest(hall.Id);

        var result = await service.ValidateBookingRequestAsync(request);

        Assert.Equal(hall.Id, result.HallId);
        Assert.Equal("Approved Hall", result.HallName);
        Assert.Equal(request.Date, result.Date);
        Assert.Equal(request.Periods, result.Periods);
    }

    [Fact]
    public async Task ValidateBookingRequestAsync_AuthenticatedUser_DoesNotStoreBooking()
    {
        var hall = CreateHall("Approved Hall", HallStatus.Approved);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);

        var service = CreateService(fakeRepository, new FakeCurrentUserService("user-1", authenticated: true));

        await service.ValidateBookingRequestAsync(CreateRequest(hall.Id));

        Assert.Empty(fakeRepository.Bookings);
    }

    [Fact]
    public async Task CreateBookingRequestAsync_Guest_ThrowsUnauthorizedAndPersistsNothing()
    {
        var hall = CreateHall("Approved Hall", HallStatus.Approved);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);
        ConfigurePeriods(fakeRepository, hall, BookingPeriodType.FirstPeriod);
        var bookingRepository = new FakeBookingRepository();

        var service = CreateService(fakeRepository, new FakeCurrentUserService(null, authenticated: false), bookingRepository);

        var exception = await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.CreateBookingRequestAsync(CreateRequest(hall.Id)));

        Assert.Contains("logged in", exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(bookingRepository.AddedBookings);
    }

    [Fact]
    public async Task CreateBookingRequestAsync_NotRegularUser_ThrowsForbidden()
    {
        var hall = CreateHall("Approved Hall", HallStatus.Approved);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);
        ConfigurePeriods(fakeRepository, hall, BookingPeriodType.FirstPeriod);

        var service = CreateService(
            fakeRepository,
            new FakeCurrentUserService("admin-1", authenticated: true, ApplicationRoles.Admin));

        var exception = await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.CreateBookingRequestAsync(CreateRequest(hall.Id)));

        Assert.Contains("regular users", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreateBookingRequestAsync_HallOwner_ThrowsForbidden()
    {
        var hall = CreateHall("Approved Hall", HallStatus.Approved);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);
        ConfigurePeriods(fakeRepository, hall, BookingPeriodType.FirstPeriod);

        var service = CreateService(
            fakeRepository,
            new FakeCurrentUserService("owner-1", authenticated: true, ApplicationRoles.HallOwner));

        var exception = await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.CreateBookingRequestAsync(CreateRequest(hall.Id)));

        Assert.Contains("hall owners", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreateBookingRequestAsync_UnknownHall_ThrowsNotFound()
    {
        var fakeRepository = new FakeHallRepository();
        var service = CreateService(fakeRepository, new FakeCurrentUserService("user-1", authenticated: true, ApplicationRoles.RegisteredUser));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.CreateBookingRequestAsync(CreateRequest(Guid.NewGuid())));
    }

    [Fact]
    public async Task CreateBookingRequestAsync_PendingHall_ThrowsNotFound()
    {
        var hall = CreateHall("Pending Hall", HallStatus.PendingReview);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);
        var service = CreateService(fakeRepository, new FakeCurrentUserService("user-1", authenticated: true, ApplicationRoles.RegisteredUser));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.CreateBookingRequestAsync(CreateRequest(hall.Id)));
    }

    [Fact]
    public async Task CreateBookingRequestAsync_RejectedHall_ThrowsNotFound()
    {
        var hall = CreateHall("Rejected Hall", HallStatus.Rejected);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);
        var service = CreateService(fakeRepository, new FakeCurrentUserService("user-1", authenticated: true, ApplicationRoles.RegisteredUser));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.CreateBookingRequestAsync(CreateRequest(hall.Id)));
    }

    [Fact]
    public async Task CreateBookingRequestAsync_DeletedHall_ThrowsNotFound()
    {
        var hall = CreateHall("Deleted Hall", HallStatus.Approved);
        hall.IsDeleted = true;
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);
        var service = CreateService(fakeRepository, new FakeCurrentUserService("user-1", authenticated: true, ApplicationRoles.RegisteredUser));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.CreateBookingRequestAsync(CreateRequest(hall.Id)));
    }

    [Fact]
    public async Task CreateBookingRequestAsync_OwnHall_ThrowsForbidden()
    {
        var hall = CreateHall("Own Hall", HallStatus.Approved);
        hall.OwnerId = "user-1";
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);
        ConfigurePeriods(fakeRepository, hall, BookingPeriodType.FirstPeriod);

        var service = CreateService(
            fakeRepository,
            new FakeCurrentUserService("user-1", authenticated: true, ApplicationRoles.RegisteredUser));

        var exception = await Assert.ThrowsAsync<ForbiddenException>(() =>
            service.CreateBookingRequestAsync(CreateRequest(hall.Id)));

        Assert.Contains("own hall", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreateBookingRequestAsync_PastDate_ThrowsValidation()
    {
        var hall = CreateHall("Approved Hall", HallStatus.Approved);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);
        ConfigurePeriods(fakeRepository, hall, BookingPeriodType.FirstPeriod);

        var service = CreateService(fakeRepository, new FakeCurrentUserService("user-1", authenticated: true, ApplicationRoles.RegisteredUser));

        var exception = await Assert.ThrowsAsync<ValidationException>(() =>
            service.CreateBookingRequestAsync(CreateRequest(hall.Id, new DateOnly(2020, 1, 1), BookingPeriodType.FirstPeriod)));

        Assert.Contains("future", exception.Errors["Date"][0], StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreateBookingRequestAsync_EmptyPeriods_ThrowsValidation()
    {
        var hall = CreateHall("Approved Hall", HallStatus.Approved);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);
        ConfigurePeriods(fakeRepository, hall, BookingPeriodType.FirstPeriod);

        var service = CreateService(fakeRepository, new FakeCurrentUserService("user-1", authenticated: true, ApplicationRoles.RegisteredUser));

        var exception = await Assert.ThrowsAsync<ValidationException>(() =>
            service.CreateBookingRequestAsync(CreateRequest(hall.Id, new List<BookingPeriodType>())));

        Assert.Contains("period", exception.Errors["Periods"][0], StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreateBookingRequestAsync_UnconfiguredPeriod_ThrowsValidation()
    {
        var hall = CreateHall("Approved Hall", HallStatus.Approved);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);
        ConfigurePeriods(fakeRepository, hall, BookingPeriodType.FirstPeriod);

        var service = CreateService(fakeRepository, new FakeCurrentUserService("user-1", authenticated: true, ApplicationRoles.RegisteredUser));

        var exception = await Assert.ThrowsAsync<ValidationException>(() =>
            service.CreateBookingRequestAsync(
                CreateRequest(hall.Id, [BookingPeriodType.SecondPeriod])));

        Assert.Contains("period", exception.Errors["Periods"][0], StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreateBookingRequestAsync_SinglePeriod_BooksAndReturnsResult()
    {
        var hall = CreateHall("Approved Hall", HallStatus.Approved);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);
        ConfigurePeriods(fakeRepository, hall, BookingPeriodType.FirstPeriod);
        var bookingRepository = new FakeBookingRepository();
        var unitOfWork = new FakeUnitOfWork();

        var service = CreateService(
            fakeRepository,
            new FakeCurrentUserService("user-1", authenticated: true, ApplicationRoles.RegisteredUser),
            bookingRepository,
            unitOfWork);

        var result = await service.CreateBookingRequestAsync(CreateRequest(hall.Id));

        var booking = Assert.Single(bookingRepository.AddedBookings);
        Assert.Equal(hall.Id, booking.HallId);
        Assert.Equal("user-1", booking.RequesterUserId);
        Assert.Equal(new DateOnly(2026, 9, 10), booking.Date);
        Assert.Equal(BookingPeriodType.FirstPeriod, booking.Period);
        Assert.Equal(BookingStatus.Pending, booking.Status);

        Assert.Single(bookingRepository.Reservations);
        Assert.Equal(hall.Id, bookingRepository.Reservations[0].HallId);
        Assert.Equal(BookingPeriodType.FirstPeriod, bookingRepository.Reservations[0].Period);

        Assert.Equal(hall.Id, result.HallId);
        Assert.Equal("Approved Hall", result.HallName);
        Assert.Equal("user-1", result.RequesterUserId);
        Assert.Equal(BookingStatus.Pending, result.Status);
        var item = Assert.Single(result.Periods);
        Assert.Equal(booking.Id, item.BookingId);
        Assert.Equal(BookingPeriodType.FirstPeriod, item.Period);

        Assert.True(unitOfWork.Transaction.Committed);
        Assert.True(unitOfWork.SaveCount > 0);
    }

    [Fact]
    public async Task CreateBookingRequestAsync_BothPeriods_CreatesTwoBookings()
    {
        var hall = CreateHall("Approved Hall", HallStatus.Approved);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);
        ConfigurePeriods(fakeRepository, hall, BookingPeriodType.FirstPeriod, BookingPeriodType.SecondPeriod);
        var bookingRepository = new FakeBookingRepository();

        var service = CreateService(
            fakeRepository,
            new FakeCurrentUserService("user-1", authenticated: true, ApplicationRoles.RegisteredUser),
            bookingRepository);

        var result = await service.CreateBookingRequestAsync(
            CreateRequest(hall.Id, [BookingPeriodType.FirstPeriod, BookingPeriodType.SecondPeriod]));

        Assert.Equal(2, bookingRepository.AddedBookings.Count);
        Assert.Equal(2, bookingRepository.Reservations.Count);
        Assert.Equal(2, result.Periods.Count);
        Assert.All(bookingRepository.AddedBookings, booking => Assert.Equal(BookingStatus.Pending, booking.Status));
    }

    [Fact]
    public async Task CreateBookingRequestAsync_DuplicatePeriods_AreRequestedOnce()
    {
        var hall = CreateHall("Approved Hall", HallStatus.Approved);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);
        ConfigurePeriods(fakeRepository, hall, BookingPeriodType.FirstPeriod);
        var bookingRepository = new FakeBookingRepository();

        var service = CreateService(
            fakeRepository,
            new FakeCurrentUserService("user-1", authenticated: true, ApplicationRoles.RegisteredUser),
            bookingRepository);

        var result = await service.CreateBookingRequestAsync(
            CreateRequest(hall.Id, [BookingPeriodType.FirstPeriod, BookingPeriodType.FirstPeriod]));

        Assert.Single(bookingRepository.AddedBookings);
        Assert.Single(bookingRepository.Reservations);
        Assert.Single(result.Periods);
    }

    [Fact]
    public async Task CreateBookingRequestAsync_TakenPeriod_ThrowsConflictAndPersistsNothing()
    {
        var hall = CreateHall("Approved Hall", HallStatus.Approved);
        var fakeRepository = new FakeHallRepository();
        fakeRepository.Halls.Add(hall);
        ConfigurePeriods(fakeRepository, hall, BookingPeriodType.FirstPeriod, BookingPeriodType.SecondPeriod);
        var bookingRepository = new FakeBookingRepository();
        bookingRepository.BlockedPeriods.Add(BookingPeriodType.SecondPeriod);
        var unitOfWork = new FakeUnitOfWork();

        var service = CreateService(
            fakeRepository,
            new FakeCurrentUserService("user-1", authenticated: true, ApplicationRoles.RegisteredUser),
            bookingRepository,
            unitOfWork);

        var exception = await Assert.ThrowsAsync<ConflictException>(() =>
            service.CreateBookingRequestAsync(
                CreateRequest(hall.Id, [BookingPeriodType.FirstPeriod, BookingPeriodType.SecondPeriod])));

        Assert.Contains("no longer available", exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(bookingRepository.AddedBookings);
        Assert.False(unitOfWork.Transaction.Committed);
        Assert.True(unitOfWork.Transaction.RolledBack);
    }

    private static BookingRequestService CreateService(
        FakeHallRepository repository,
        FakeCurrentUserService currentUser,
        FakeBookingRepository? bookingRepository = null,
        FakeUnitOfWork? unitOfWork = null)
        => new(
            repository,
            currentUser,
            bookingRepository ?? new FakeBookingRepository(),
            unitOfWork ?? new FakeUnitOfWork());

    private static BookingRequestDto CreateRequest(Guid hallId)
        => CreateRequest(hallId, new DateOnly(2026, 9, 10), [BookingPeriodType.FirstPeriod]);

    private static BookingRequestDto CreateRequest(Guid hallId, IReadOnlyList<BookingPeriodType> periods)
        => CreateRequest(hallId, new DateOnly(2026, 9, 10), periods.ToArray());

    private static BookingRequestDto CreateRequest(Guid hallId, DateOnly date, params BookingPeriodType[] periods)
        => new()
        {
            HallId = hallId,
            Date = date,
            Periods = periods
        };

    private static Hall CreateHall(string name, HallStatus status)
        => new()
        {
            Id = Guid.NewGuid(),
            Name = name,
            Status = status,
            OwnerId = "owner-1"
        };

    private static void ConfigurePeriods(FakeHallRepository repository, Hall hall, params BookingPeriodType[] types)
    {
        foreach (var type in types)
        {
            repository.BookingPeriods.Add(new HallBookingPeriod
            {
                HallId = hall.Id,
                Type = type,
                StartTime = new TimeOnly(9, 0),
                EndTime = new TimeOnly(12, 0)
            });
        }
    }

    private sealed class FakeHallRepository : IHallRepository
    {
        public List<Hall> Halls { get; } = [];

        public List<HallBookingPeriod> BookingPeriods { get; } = [];

        public List<object> Bookings { get; } = [];

        public Task<Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default)
            => Task.FromResult(Halls.FirstOrDefault(hall => hall.Id == id));

        public Task<IReadOnlyList<Hall>> GetApprovedHallsAsync(int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(Halls.Take(count).ToList());

        public Task<IReadOnlyList<Hall>> GetApprovedHallsPaginatedAsync(
            int skip,
            int take,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(Halls.Skip(skip).Take(take).ToList());

        public Task<int> GetApprovedHallsCountAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(Halls.Count);

        public Task<IReadOnlyList<Hall>> SearchApprovedHallsAsync(
            string? name, HallRegion? region, string? area,
            DateOnly? date, BookingPeriodType? period,
            int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(Halls.Skip(skip).Take(take).ToList());

        public Task<int> SearchApprovedHallsCountAsync(
            string? name, HallRegion? region, string? area,
            DateOnly? date, BookingPeriodType? period,
            CancellationToken cancellationToken = default)
            => Task.FromResult(Halls.Count);

        public Task<IReadOnlyList<Hall>> GetApprovedHallsByRegionAsync(
            HallRegion region,
            int count,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>(
                Halls.Where(hall => hall.Region == region).Take(count).ToList());

        public Task<IReadOnlyList<HallImage>> GetHallImagesAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallImage>>([]);

        public Task<IReadOnlyList<HallBookingPeriod>> GetBookingPeriodsAsync(
            IReadOnlyCollection<Guid> hallIds,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallBookingPeriod>>(
                BookingPeriods.Where(period => hallIds.Contains(period.HallId)).ToList());

        public Task<IReadOnlyList<HallAvailability>> GetAvailabilityAsync(
            IReadOnlyCollection<Guid> hallIds,
            DateOnly fromDate,
            DateOnly toDate,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallAvailability>>([]);
    }

    private sealed class FakeCurrentUserService : ICurrentUserService
    {
        public FakeCurrentUserService(string? userId, bool authenticated, params string[] roles)
        {
            UserId = userId;
            IsAuthenticated = authenticated;
            Roles = roles;
        }

        public string? UserId { get; }

        public string? UserName => null;

        public string? Email => null;

        public bool IsAuthenticated { get; }

        public IReadOnlyList<string> Roles { get; }
    }

    private sealed class FakeBookingRepository : IBookingRepository
    {
        public List<Booking> AddedBookings { get; } = [];

        public HashSet<BookingPeriodType> BlockedPeriods { get; } = [];

        public List<(Guid HallId, DateOnly Date, BookingPeriodType Period)> Reservations { get; } = [];

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

        public Task<bool> HasOtherActiveBookingsAsync(
            Guid hallId,
            DateOnly date,
            BookingPeriodType periodType,
            Guid bookingId,
            CancellationToken cancellationToken = default)
            => Task.FromResult(false);

        public Task<int> ReleasePeriodAsync(
            Guid hallId,
            DateOnly date,
            BookingPeriodType periodType,
            CancellationToken cancellationToken = default)
            => Task.FromResult(0);

        public Task<int> ReservePeriodAsync(
            Guid hallId,
            DateOnly date,
            BookingPeriodType periodType,
            CancellationToken cancellationToken = default)
        {
            Reservations.Add((hallId, date, periodType));
            return Task.FromResult(BlockedPeriods.Contains(periodType) ? 0 : 1);
        }
    }

    private sealed class FakeUnitOfWork : IUnitOfWork
    {
        public FakeWesalTransaction Transaction { get; } = new();

        public int SaveCount { get; private set; }

        public Task<IWesalTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IWesalTransaction>(Transaction);

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            SaveCount++;
            return Task.FromResult(1);
        }
    }

    private sealed class FakeWesalTransaction : IWesalTransaction
    {
        public bool Committed { get; private set; }

        public bool RolledBack { get; private set; }

        public Task CommitAsync(CancellationToken cancellationToken = default)
        {
            Committed = true;
            return Task.CompletedTask;
        }

        public Task RollbackAsync(CancellationToken cancellationToken = default)
        {
            RolledBack = true;
            return Task.CompletedTask;
        }

        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }
}
