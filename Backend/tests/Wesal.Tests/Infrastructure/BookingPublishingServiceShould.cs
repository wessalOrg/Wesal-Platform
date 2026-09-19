using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Bookings;

namespace Wesal.Tests.Infrastructure;

public class BookingPublishingServiceShould
{
    private const string HallOwnerId = "owner-1";
    private const string RequesterId = "user-1";

    [Fact]
    public async Task PublishBooking_OwnAcceptedBooking_ReturnsPublishedResult()
    {
        var scenario = Scenario();

        var result = await scenario.Service.PublishBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        Assert.Equal(scenario.Booking.Id, result.BookingId);
        Assert.Equal(scenario.Hall.Id, result.HallId);
        Assert.Equal(scenario.Hall.Name, result.HallName);
        Assert.Equal(RequesterId, result.RequesterUserId);
        Assert.Equal(new DateOnly(2035, 6, 1), result.Date);
        Assert.Equal(BookingPeriodType.FirstPeriod, result.Period);
        Assert.Equal(BookingStatus.Accepted, result.Status);
        Assert.True(result.IsPublished);
    }

    [Fact]
    public async Task PublishBooking_OwnAcceptedBooking_MarksBookingPublished()
    {
        var scenario = Scenario();

        await scenario.Service.PublishBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        Assert.True(scenario.Booking.IsPublished);
        Assert.Equal(BookingStatus.Accepted, scenario.Booking.Status);
    }

    [Fact]
    public async Task PublishBooking_PreservesRequesterHallDateAndPeriod()
    {
        var scenario = Scenario();

        await scenario.Service.PublishBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        Assert.Equal(RequesterId, scenario.Booking.RequesterUserId);
        Assert.Equal(scenario.Hall.Id, scenario.Booking.HallId);
        Assert.Equal(new DateOnly(2035, 6, 1), scenario.Booking.Date);
        Assert.Equal(BookingPeriodType.FirstPeriod, scenario.Booking.Period);
    }

    [Fact]
    public async Task PublishBooking_OnlyTouchesTheRequestedPeriod_AndNeverReleases()
    {
        var scenario = Scenario();

        await scenario.Service.PublishBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        var reserved = Assert.Single(scenario.BookingRepository.ReservedPeriods);
        Assert.Equal(scenario.Booking.HallId, reserved.HallId);
        Assert.Equal(scenario.Booking.Date, reserved.Date);
        Assert.Equal(scenario.Booking.Period, reserved.Period);
        Assert.Empty(scenario.BookingRepository.ReleasedPeriods);
    }

    [Fact]
    public async Task PublishBooking_PerformsFinalAvailabilityCheck()
    {
        var scenario = Scenario();

        await scenario.Service.PublishBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        Assert.True(scenario.BookingRepository.AvailabilityCheckPerformed);
    }

    [Fact]
    public async Task PublishBooking_CompetingActiveBooking_ThrowsConflict_WithoutSideEffects()
    {
        var scenario = Scenario();
        scenario.BookingRepository.HasCompetingBooking = true;

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.PublishBookingAsync(scenario.Hall.Id, scenario.Booking.Id));

        Assert.False(scenario.Booking.IsPublished);
        Assert.Empty(scenario.BookingRepository.ReservedPeriods);
    }

    [Fact]
    public async Task PublishBooking_Unauthenticated_ThrowsUnauthorized()
    {
        var scenario = Scenario(userId: null);

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            scenario.Service.PublishBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task PublishBooking_RegisteredUser_ThrowsForbidden()
    {
        var scenario = Scenario(userId: RequesterId, roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            scenario.Service.PublishBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task PublishBooking_Admin_ThrowsForbidden()
    {
        var scenario = Scenario(userId: "admin-1", roles: [ApplicationRoles.Admin]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            scenario.Service.PublishBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task PublishBooking_AnotherOwner_ThrowsForbidden()
    {
        var scenario = Scenario(userId: "owner-2", roles: [ApplicationRoles.HallOwner]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            scenario.Service.PublishBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task PublishBooking_UnknownBooking_ThrowsNotFound()
    {
        var scenario = Scenario();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            scenario.Service.PublishBookingAsync(scenario.Hall.Id, Guid.NewGuid()));
    }

    [Fact]
    public async Task PublishBooking_WrongHallId_ThrowsNotFound()
    {
        var scenario = Scenario();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            scenario.Service.PublishBookingAsync(Guid.NewGuid(), scenario.Booking.Id));
    }

    [Fact]
    public async Task PublishBooking_DeletedHall_ThrowsNotFound()
    {
        var scenario = Scenario();
        scenario.Hall.IsDeleted = true;

        await Assert.ThrowsAsync<NotFoundException>(() =>
            scenario.Service.PublishBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task PublishBooking_PendingBooking_ThrowsConflict()
    {
        var scenario = Scenario(status: BookingStatus.Pending);

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.PublishBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task PublishBooking_RejectedBooking_ThrowsConflict()
    {
        var scenario = Scenario(status: BookingStatus.Rejected);

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.PublishBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task PublishBooking_CancelledBooking_ThrowsConflict()
    {
        var scenario = Scenario(status: BookingStatus.Cancelled);

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.PublishBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task PublishBooking_AlreadyPublished_ThrowsConflict()
    {
        var scenario = Scenario(isPublished: true);

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.PublishBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task PublishBooking_RaceLost_ThrowsConflict_WithoutSideEffects()
    {
        var scenario = Scenario();
        scenario.BookingRepository.ForceZeroConditionalUpdate = true;

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.PublishBookingAsync(scenario.Hall.Id, scenario.Booking.Id));

        Assert.Equal(BookingStatus.Accepted, scenario.Booking.Status);
        Assert.False(scenario.Booking.IsPublished);
    }

    [Fact]
    public async Task PublishBooking_StorageFailure_RollsBackPublication()
    {
        var scenario = Scenario();
        scenario.UnitOfWork.ThrowOnSave = true;

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            scenario.Service.PublishBookingAsync(scenario.Hall.Id, scenario.Booking.Id));

        Assert.Equal(BookingStatus.Accepted, scenario.Booking.Status);
        Assert.False(scenario.Booking.IsPublished);
        Assert.True(scenario.UnitOfWork.RolledBack);
    }

    [Fact]
    public async Task PublishBooking_KeepsBookingHistory()
    {
        var scenario = Scenario();

        await scenario.Service.PublishBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        Assert.Contains(scenario.Booking.Id, scenario.Bookings.Select(b => b.Id));
    }

    [Fact]
    public async Task PublishBooking_RepeatAttempt_ThrowsConflict()
    {
        var scenario = Scenario();

        await scenario.Service.PublishBookingAsync(scenario.Hall.Id, scenario.Booking.Id);

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.PublishBookingAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task PublishBooking_PendingBooking_TellsOwnerToAcceptFirst()
    {
        var scenario = Scenario(status: BookingStatus.Pending);

        var exception = await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.PublishBookingAsync(scenario.Hall.Id, scenario.Booking.Id));

        Assert.Contains("accept", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    private static ScenarioContext Scenario(
        IReadOnlyList<Booking>? bookings = null,
        string? userId = HallOwnerId,
        IReadOnlyList<string>? roles = null,
        BookingStatus status = BookingStatus.Accepted,
        bool isPublished = false)
    {
        var bookingsList = bookings ?? [CreateBooking(Hall(), RequesterId, status, isPublished)];
        var hall = bookingsList[0].Hall;

        var unitOfWork = new FakeUnitOfWork(bookingsList.ToList());

        var context = new ScenarioContext
        {
            BookingRepository = new FakeBookingRepository([.. bookingsList]),
            UnitOfWork = unitOfWork,
            CurrentUser = CurrentUser(userId, roles ?? [ApplicationRoles.HallOwner]),
            Service = null!
        };

        context.Service = new BookingPublishingService(
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

    private static Booking CreateBooking(
        Hall hall,
        string requesterId,
        BookingStatus status = BookingStatus.Accepted,
        bool isPublished = false)
        => new()
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            Hall = hall,
            RequesterUserId = requesterId,
            Date = new DateOnly(2035, 6, 1),
            Period = BookingPeriodType.FirstPeriod,
            Status = status,
            IsPublished = isPublished
        };

    private sealed class ScenarioContext
    {
        public required FakeBookingRepository BookingRepository { get; init; }

        public required FakeUnitOfWork UnitOfWork { get; init; }

        public required FakeCurrentUserService CurrentUser { get; init; }

        public required BookingPublishingService Service { get; set; }

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

        public bool ForceZeroConditionalUpdate { get; set; }

        public bool HasCompetingBooking { get; set; }

        public bool AvailabilityCheckPerformed { get; private set; }

        public List<(Guid HallId, DateOnly Date, BookingPeriodType Period)> ReservedPeriods { get; } = [];

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

            if (booking is null || booking.Status != BookingStatus.Pending)
            {
                return Task.FromResult(0);
            }

            booking.Status = BookingStatus.Accepted;
            return Task.FromResult(1);
        }

        public Task<int> PublishAcceptedAsync(
            Guid bookingId,
            CancellationToken cancellationToken = default)
        {
            var booking = _bookings.FirstOrDefault(b => b.Id == bookingId);

            if (booking is null
                || booking.Status != BookingStatus.Accepted
                || booking.IsPublished
                || ForceZeroConditionalUpdate)
            {
                return Task.FromResult(0);
            }

            booking.IsPublished = true;
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
            AvailabilityCheckPerformed = true;
            var hasOther = HasCompetingBooking || _bookings.Any(b =>
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
        {
            ReservedPeriods.Add((hallId, date, periodType));
            return Task.FromResult(1);
        }
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
                .Select(b => new BookingPublicationSnapshot(b.Id, b.Status, b.IsPublished))
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

        private void Restore(IReadOnlyList<BookingPublicationSnapshot> snapshot)
        {
            foreach (var item in snapshot)
            {
                var booking = _bookings.FirstOrDefault(b => b.Id == item.Id);

                if (booking is not null)
                {
                    booking.Status = item.Status;
                    booking.IsPublished = item.IsPublished;
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

    private sealed record BookingPublicationSnapshot(Guid Id, BookingStatus Status, bool IsPublished);

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