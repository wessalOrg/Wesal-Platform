using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Bookings;

namespace Wesal.Tests.Infrastructure;

public class BookingDeletionServiceShould
{
    private const string HallOwnerId = "owner-1";
    private const string RequesterId = "user-1";

    [Fact]
    public async Task Delete_Unauthenticated_ThrowsUnauthorized()
    {
        var context = Scenario(userId: null);

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            context.Service.DeleteBookingAsync(context.Hall.Id, context.Booking.Id));
    }

    [Fact]
    public async Task Delete_NonHallOwnerRole_ThrowsForbidden()
    {
        var context = Scenario(userId: RequesterId, roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            context.Service.DeleteBookingAsync(context.Hall.Id, context.Booking.Id));
    }

    [Fact]
    public async Task Delete_AnotherOwnersBooking_ThrowsForbidden()
    {
        var context = Scenario(userId: "intruder-owner");

        var exception = await Assert.ThrowsAsync<ForbiddenException>(() =>
            context.Service.DeleteBookingAsync(context.Hall.Id, context.Booking.Id));

        Assert.Contains("delete this booking", exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Single(context.Bookings);
    }

    [Fact]
    public async Task Delete_UnknownBooking_ThrowsNotFound()
    {
        var context = Scenario();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            context.Service.DeleteBookingAsync(context.Hall.Id, Guid.NewGuid()));
    }

    [Fact]
    public async Task Delete_BookingOfAnotherHall_ThrowsNotFound()
    {
        var context = Scenario();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            context.Service.DeleteBookingAsync(Guid.NewGuid(), context.Booking.Id));
    }

    [Fact]
    public async Task Delete_BookingOfDeletedHall_ThrowsNotFound_AndKeepsState()
    {
        var hall = Hall();
        hall.IsDeleted = true;
        var context = Scenario(bookings: [CreateBooking(hall, RequesterId)]);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            context.Service.DeleteBookingAsync(hall.Id, context.Booking.Id));

        Assert.Single(context.Bookings);
        Assert.Empty(context.BookingRepository.ReleasedPeriods);
    }

    [Fact]
    public async Task Delete_PendingBooking_RemovesBooking_ReleasesExactPeriod_AndCommits()
    {
        var context = Scenario();
        var booking = context.Booking;
        var hallId = context.Hall.Id;

        var result = await context.Service.DeleteBookingAsync(hallId, booking.Id);

        Assert.Equal(booking.Id, result.BookingId);
        Assert.Equal(hallId, result.HallId);
        Assert.Equal(RequesterId, result.RequesterUserId);
        Assert.True(context.UnitOfWork.Transaction.Committed);
        Assert.Empty(context.Bookings);
        var released = Assert.Single(context.BookingRepository.ReleasedPeriods);
        Assert.Equal((hallId, booking.Date, booking.Period), released);
    }

    [Fact]
    public async Task Delete_AcceptedBooking_RemovesBooking_AndReleasesExactPeriod()
    {
        var context = Scenario(status: BookingStatus.Accepted);

        var result = await context.Service.DeleteBookingAsync(context.Hall.Id, context.Booking.Id);

        Assert.Equal(BookingStatus.Accepted, result.Status);
        Assert.False(result.IsPublished);
        Assert.Empty(context.Bookings);
        Assert.Single(context.BookingRepository.ReleasedPeriods);
        Assert.True(context.BookingRepository.AvailabilityCheckPerformed);
    }

    [Fact]
    public async Task Delete_PublishedBooking_RemovesBooking_AndClearsPublicBooked()
    {
        var context = Scenario(status: BookingStatus.Accepted, isPublished: true);
        var booking = context.Booking;
        var hallId = context.Hall.Id;

        var result = await context.Service.DeleteBookingAsync(hallId, booking.Id);

        Assert.True(result.IsPublished);
        Assert.Empty(context.Bookings);
        var released = Assert.Single(context.BookingRepository.ReleasedPeriods);
        Assert.Equal((hallId, booking.Date, booking.Period), released);
    }

    [Fact]
    public async Task Delete_CompetingActiveClaim_SkipsRelease()
    {
        var context = Scenario();
        context.BookingRepository.HasCompetingBooking = true;

        await context.Service.DeleteBookingAsync(context.Hall.Id, context.Booking.Id);

        Assert.Empty(context.Bookings);
        Assert.Empty(context.BookingRepository.ReleasedPeriods);
    }

    [Fact]
    public async Task Delete_ConcurrentDeletion_ThrowsConflict_AndNothingReleasedOrCommitted()
    {
        var context = Scenario();
        context.BookingRepository.ForceZeroConditionalUpdate = true;

        var exception = await Assert.ThrowsAsync<ConflictException>(() =>
            context.Service.DeleteBookingAsync(context.Hall.Id, context.Booking.Id));

        Assert.Contains("already been deleted", exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Single(context.Bookings);
        Assert.Empty(context.BookingRepository.ReleasedPeriods);
        Assert.False(context.UnitOfWork.Transaction.Committed);
    }

    [Fact]
    public async Task Delete_ReleasesOnlyTheExactRequestedPeriod()
    {
        var context = Scenario(status: BookingStatus.Pending);
        var booking = context.Booking;
        var hallId = context.Hall.Id;

        await context.Service.DeleteBookingAsync(hallId, booking.Id);

        var released = Assert.Single(context.BookingRepository.ReleasedPeriods);
        Assert.Equal(booking.Date, released.Date);
        Assert.Equal(booking.Period, released.Period);
        Assert.Equal(hallId, released.HallId);
    }

    [Fact]
    public async Task Delete_LeavesOtherBookingsUntouched()
    {
        var hall = Hall();
        var first = CreateBooking(hall, RequesterId, BookingStatus.Pending);
        var second = CreateBooking(hall, "user-2", BookingStatus.Pending);
        second.Date = new DateOnly(2035, 6, 2);
        second.Period = BookingPeriodType.SecondPeriod;
        var context = Scenario(bookings: [first, second]);

        await context.Service.DeleteBookingAsync(hall.Id, first.Id);

        var remaining = Assert.Single(context.Bookings);
        Assert.Equal(second.Id, remaining.Id);
    }

    [Fact]
    public async Task Delete_ResultReflectsLastPersistedState()
    {
        var hall = Hall();
        var booking = CreateBooking(hall, RequesterId, BookingStatus.Cancelled);
        var context = Scenario(bookings: [booking]);

        var result = await context.Service.DeleteBookingAsync(hall.Id, booking.Id);

        Assert.Equal(BookingStatus.Cancelled, result.Status);
        Assert.False(result.IsPublished);
        Assert.Equal(booking.Date, result.Date);
        Assert.Equal(booking.Period, result.Period);
        Assert.Equal(hall.Name, result.HallName);
    }

    private static ScenarioContext Scenario(
        IReadOnlyList<Booking>? bookings = null,
        string? userId = HallOwnerId,
        IReadOnlyList<string>? roles = null,
        BookingStatus status = BookingStatus.Pending,
        bool isPublished = false)
    {
        var bookingsList = bookings ?? [CreateBooking(Hall(), RequesterId, status, isPublished)];

        var unitOfWork = new FakeUnitOfWork();

        var context = new ScenarioContext
        {
            BookingRepository = new FakeBookingRepository([.. bookingsList]),
            UnitOfWork = unitOfWork,
            CurrentUser = CurrentUser(userId, roles ?? [ApplicationRoles.HallOwner]),
            Service = null!
        };

        context.Service = new BookingDeletionService(
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
        BookingStatus status = BookingStatus.Pending,
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

        public required BookingDeletionService Service { get; set; }

        public IReadOnlyList<Booking> Bookings => BookingRepository.Bookings;

        public Booking Booking => BookingRepository.Bookings[0];

        public Hall Hall => Booking.Hall;
    }

    private sealed class FakeCurrentUserService : ICurrentUserService
    {
        public FakeCurrentUserService(string? userId, bool authenticated, IReadOnlyList<string> roles)
        {
            UserId = userId;
            IsAuthenticated = authenticated;
            Roles = roles;
        }

        public string? UserId { get; }

        public string? UserName => "testuser";

        public string? Email => "test@example.com";

        public bool IsAuthenticated { get; }

        public IReadOnlyList<string> Roles { get; }
    }

    private sealed class FakeUnitOfWork : IUnitOfWork
    {
        public FakeWesalTransaction Transaction { get; } = new();

        public Task<IWesalTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default)
            => Task.FromResult<IWesalTransaction>(Transaction);

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(1);
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

        public ValueTask DisposeAsync()
        {
            if (!Committed && !RolledBack)
            {
                RolledBack = true;
            }

            return ValueTask.CompletedTask;
        }
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
            => Task.FromResult(0);

        public Task<int> AcceptPendingAsync(
            Guid bookingId,
            CancellationToken cancellationToken = default)
            => Task.FromResult(0);

        public Task<int> PublishAcceptedAsync(
            Guid bookingId,
            CancellationToken cancellationToken = default)
            => Task.FromResult(0);

        public Task<int> DeleteAsync(
            Guid bookingId,
            CancellationToken cancellationToken = default)
        {
            if (ForceZeroConditionalUpdate)
            {
                return Task.FromResult(0);
            }

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
            => Task.FromResult(1);
    }
}