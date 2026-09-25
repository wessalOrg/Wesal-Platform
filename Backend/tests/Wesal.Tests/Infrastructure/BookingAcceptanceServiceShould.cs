using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Bookings;

namespace Wesal.Tests.Infrastructure;

public class BookingAcceptanceServiceShould
{
    private const string HallOwnerId = "owner-1";
    private const string RequesterId = "user-1";

    [Fact]
    public async Task AcceptBooking_OwnPendingBooking_ReturnsAcceptedResult()
    {
        var scenario = Scenario();

        var result = await scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        Assert.Equal(scenario.Booking.Id, result.BookingId);
        Assert.Equal(scenario.Hall.Id, result.HallId);
        Assert.Equal(scenario.Hall.Name, result.HallName);
        Assert.Equal(RequesterId, result.RequesterUserId);
        Assert.Equal(new DateOnly(2035, 6, 1), result.Date);
        Assert.Equal(BookingPeriodType.FirstPeriod, result.Period);
        Assert.Equal(BookingStatus.Accepted, result.Status);
    }

    [Fact]
    public async Task AcceptBooking_OwnPendingBooking_SetsStatusToAccepted()
    {
        var scenario = Scenario();

        await scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        Assert.Equal(BookingStatus.Accepted, scenario.Booking.Status);
    }

    [Fact]
    public async Task AcceptBooking_PreservesRequesterHallDateAndPeriod()
    {
        var scenario = Scenario();

        await scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        Assert.Equal(RequesterId, scenario.Booking.RequesterUserId);
        Assert.Equal(scenario.Hall.Id, scenario.Booking.HallId);
        Assert.Equal(new DateOnly(2035, 6, 1), scenario.Booking.Date);
        Assert.Equal(BookingPeriodType.FirstPeriod, scenario.Booking.Period);
    }

    [Fact]
    public async Task AcceptBooking_KeepsPeriodReserved()
    {
        var scenario = Scenario();

        await scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        Assert.Empty(scenario.BookingRepository.ReleasedPeriods);
    }

    [Fact]
    public async Task AcceptBooking_Unauthenticated_ThrowsUnauthorized()
    {
        var scenario = Scenario(userId: null);

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task AcceptBooking_RegisteredUser_ThrowsForbidden()
    {
        var scenario = Scenario(userId: RequesterId, roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task AcceptBooking_Admin_ThrowsForbidden()
    {
        var scenario = Scenario(userId: "admin-1", roles: [ApplicationRoles.Admin]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task AcceptBooking_AnotherOwner_ThrowsForbidden()
    {
        var scenario = Scenario(userId: "owner-2", roles: [ApplicationRoles.HallOwner]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task AcceptBooking_UnknownBooking_ThrowsNotFound()
    {
        var scenario = Scenario();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, Guid.NewGuid()));
    }

    [Fact]
    public async Task AcceptBooking_WrongHallId_ThrowsNotFound()
    {
        var scenario = Scenario();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            scenario.Service.AcceptBookingAsync(Guid.NewGuid(), scenario.Booking.Id));
    }

    [Fact]
    public async Task AcceptBooking_DeletedHall_ThrowsNotFound()
    {
        var scenario = Scenario();
        scenario.Hall.IsDeleted = true;

        await Assert.ThrowsAsync<NotFoundException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task AcceptBooking_AlreadyAccepted_ThrowsConflict()
    {
        var scenario = Scenario();
        scenario.Booking.Status = BookingStatus.Accepted;

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task AcceptBooking_RejectedBooking_ThrowsConflict()
    {
        var scenario = Scenario();
        scenario.Booking.Status = BookingStatus.Rejected;

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task AcceptBooking_CancelledBooking_ThrowsConflict()
    {
        var scenario = Scenario();
        scenario.Booking.Status = BookingStatus.Cancelled;

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task AcceptBooking_RaceLost_ThrowsConflict_WithoutSideEffects()
    {
        var scenario = Scenario();
        scenario.BookingRepository.ForceZeroConditionalUpdate = true;

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id));

        Assert.Equal(BookingStatus.Pending, scenario.Booking.Status);
        Assert.False(scenario.BookingRepository.AcceptedAgainstCancelled);
    }

    [Fact]
    public async Task AcceptBooking_StorageFailure_RollsBackStatusToPending()
    {
        var scenario = Scenario();
        scenario.UnitOfWork.ThrowOnSave = true;

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id));

        Assert.Equal(BookingStatus.Pending, scenario.Booking.Status);
    }

    [Fact]
    public async Task AcceptBooking_ExcludesBookingFromPendingSet_WhileKeepingHistory()
    {
        var scenario = Scenario();

        await scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        var pendingBookings = scenario.BookingRepository.PendingBookings;
        Assert.DoesNotContain(scenario.Booking.Id, pendingBookings.Select(b => b.Id));
        Assert.Contains(scenario.Booking.Id, scenario.Bookings.Select(b => b.Id));
    }

    [Fact]
    public async Task AcceptBooking_RepeatAttempt_ThrowsConflict()
    {
        var scenario = Scenario();

        await scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.AcceptBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    private static ScenarioContext Scenario(
        IReadOnlyList<Booking>? bookings = null,
        string? userId = HallOwnerId,
        IReadOnlyList<string>? roles = null)
    {
        var bookingsList = bookings ?? [CreateBooking(Hall(), RequesterId)];
        var hall = bookingsList[0].Hall;

        var context = new ScenarioContext
        {
            BookingRepository = new FakeBookingRepository([.. bookingsList]),
            UnitOfWork = new FakeUnitOfWork(),
            CurrentUser = CurrentUser(userId, roles ?? [ApplicationRoles.HallOwner]),
            Service = null!
        };

        var unitOfWork = new FakeUnitOfWork(context.BookingRepository.Bookings.ToList());

        context.UnitOfWork = unitOfWork;

        context.Service = new BookingAcceptanceService(
            context.BookingRepository,
            unitOfWork,
            context.CurrentUser);

        return context;
    }

    private static FakeCurrentUserService CurrentUser(string? userId, IReadOnlyList<string> roles)
        => new(userId, userId is not null, roles);

    private static Hall Hall()
        => new()
        {
            Id = Guid.NewGuid(),
            Name = "Grand Hall",
            Status = HallStatus.Approved,
            PaymentStatus = HallPaymentStatus.Paid,
            OwnerId = HallOwnerId
        };

    private static Booking CreateBooking(Hall hall, string requesterId, BookingStatus status = BookingStatus.Pending)
        => new()
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            Hall = hall,
            RequesterUserId = requesterId,
            Date = new DateOnly(2035, 6, 1),
            Period = BookingPeriodType.FirstPeriod,
            Status = status
        };

    private sealed class ScenarioContext
    {
        public required FakeBookingRepository BookingRepository { get; init; }

        public FakeUnitOfWork UnitOfWork { get; set; } = null!;

        public required FakeCurrentUserService CurrentUser { get; init; }

        public required BookingAcceptanceService Service { get; set; }

        public IReadOnlyList<Booking> Bookings => BookingRepository.Bookings;

        public Booking Booking => BookingRepository.Bookings[0];

        public Hall Hall => Booking.Hall;
    }

    private sealed class FakeBookingRepository : IBookingRepository
    {
        private readonly List<Booking> _bookings;

        public FakeBookingRepository(List<Booking> bookings)
        {
            _bookings = bookings;
        }

        public IReadOnlyList<Booking> Bookings => _bookings;

        public IEnumerable<Booking> PendingBookings
            => _bookings.Where(b => b.Status == BookingStatus.Pending);

        public bool ForceZeroConditionalUpdate { get; set; }

        public bool AcceptedAgainstCancelled { get; private set; }

        public List<(Guid HallId, DateOnly Date, BookingPeriodType Period)> ReleasedPeriods { get; } = [];

        public Task AddAsync(Booking booking, CancellationToken cancellationToken = default)
        {
            _bookings.Add(booking);
            return Task.CompletedTask;
        }

        public Task<Booking?> GetByIdWithHallAsync(Guid bookingId, CancellationToken cancellationToken = default)
            => Task.FromResult(_bookings.FirstOrDefault(b => b.Id == bookingId));

        public Task<IReadOnlyList<Booking>> GetPendingRejectionNotificationsAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Booking>>([]);

        public Task<int> CancelPendingAsync(
            Guid bookingId,
            string requesterUserId,
            CancellationToken cancellationToken = default)
        {
            var booking = _bookings.FirstOrDefault(b => b.Id == bookingId);

            if (booking is null
                || !string.Equals(booking.RequesterUserId, requesterUserId, StringComparison.Ordinal)
                || booking.Status != BookingStatus.Pending)
            {
                return Task.FromResult(0);
            }

            booking.Status = BookingStatus.Cancelled;
            return Task.FromResult(1);
        }

        public Task<int> AcceptPendingAsync(
            Guid bookingId,
            CancellationToken cancellationToken = default)
        {
            var booking = _bookings.FirstOrDefault(b => b.Id == bookingId);

            if (booking is null
                || booking.Status != BookingStatus.Pending
                || booking.Status == BookingStatus.Cancelled
                || ForceZeroConditionalUpdate)
            {
                AcceptedAgainstCancelled = booking?.Status == BookingStatus.Cancelled;
                return Task.FromResult(0);
            }

            booking.Status = BookingStatus.Accepted;
            return Task.FromResult(1);
        }

        public Task<int> DeleteAsync(
            Guid bookingId,
            CancellationToken cancellationToken = default)
        {
            var booking = _bookings.FirstOrDefault(b => b.Id == bookingId);

            if (booking is null)
            {
                return Task.FromResult(0);
            }

            _bookings.Remove(booking);
            return Task.FromResult(1);
        }

        public Task<bool> HasOtherActiveBookingsAsync(
            Guid hallId,
            DateOnly date,
            BookingPeriodType periodType,
            Guid bookingId,
            CancellationToken cancellationToken = default)
        {
            var hasOther = _bookings.Any(b =>
                b.HallId == hallId
                && b.Date == date
                && b.Period == periodType
                && b.Id != bookingId
                && (b.Status == BookingStatus.Pending || b.Status == BookingStatus.Accepted));

            return Task.FromResult(hasOther);
        }

        public Task<int> ReleasePeriodAsync(
            Guid hallId,
            DateOnly date,
            BookingPeriodType periodType,
            CancellationToken cancellationToken = default)
        {
            ReleasedPeriods.Add((hallId, date, periodType));
            return Task.FromResult(1);
        }

        public Task<int> ReservePeriodAsync(
            Guid hallId,
            DateOnly date,
            BookingPeriodType periodType,
            CancellationToken cancellationToken = default)
            => Task.FromResult(1);
    }

    private sealed class FakeUnitOfWork : IUnitOfWork
    {
        private readonly List<Booking> _bookings;

        public FakeUnitOfWork(List<Booking>? bookings = null)
        {
            _bookings = bookings ?? [];
        }

        public bool ThrowOnSave { get; set; }

        public bool RolledBack { get; set; }

        public async Task<TResult> ExecuteInTransactionAsync<TResult>(Func<Task<TResult>> operation, CancellationToken cancellationToken = default)
        {
            var snapshot = _bookings
                .Select(b => new BookingStatusSnapshot(b.Id, b.Status))
                .ToList();

            try
            {
                var result = await operation();
                return result;
            }
            catch
            {
                Restore(snapshot);
                RolledBack = true;
                throw;
            }
        }

        public Task ExecuteInTransactionAsync(Func<Task> operation, CancellationToken cancellationToken = default)
            => ExecuteInTransactionAsync<byte>(async () => { await operation(); return 0; }, cancellationToken);

        private void Restore(IReadOnlyList<BookingStatusSnapshot> snapshot)
        {
            foreach (var item in snapshot)
            {
                var booking = _bookings.FirstOrDefault(b => b.Id == item.Id);

                if (booking is not null)
                {
                    booking.Status = item.Status;
                }
            }
        }

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            if (ThrowOnSave)
            {
                throw new InvalidOperationException("The save failed.");
            }

            return Task.FromResult(1);
        }
    }

    private sealed record BookingStatusSnapshot(Guid Id, BookingStatus Status);

    private sealed class FakeCurrentUserService : ICurrentUserService
    {
        public FakeCurrentUserService(string? userId, bool authenticated, IReadOnlyList<string> roles)
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
}