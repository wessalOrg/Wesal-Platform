using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Bookings;
using Wesal.Tests.Infrastructure;
using Wesal.Tests.TestDoubles;
using Xunit;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// WESAL-TASK-8 (Edit 8): confirming the deposit is the step that actually books a hall.
/// Everything before it merely holds hours, so this file is mostly about the moment the
/// money actually arrived: it must be allowed exactly once, only by the owning hall, only
/// for a booking that still holds its reserved hours, and it must leave nothing half-done
/// when any of that is untrue.
/// </summary>
public class BookingPaymentConfirmationServiceShould
{
    private const string OwnerId = "owner-1";
    private const string RequesterId = "user-1";
    private static readonly DateOnly BookingDate = new(2035, 6, 1);
    private static readonly TimeOnly Start = new(10, 0);
    private static readonly TimeOnly SecondStart = new(11, 0);

    [Fact]
    public async Task ConfirmPayment_ApprovedBooking_StampsPaidAndPromotesReservedHoursToBooked()
    {
        var scenario = Scenario(BookingStatus.Accepted, depositAmount: 500m);

        var result = await scenario.Service.ConfirmPaymentAsync(scenario.Hall.Id, scenario.Booking.Id);

        // The whole point of Edit 8: the hours only become officially Booked here, and only
        // together with the payment flag.
        Assert.Equal(new[] { Start, SecondStart }, result.SlotStarts);
        Assert.Equal(500m, result.DepositAmount);
        Assert.Equal(BookingStatus.Accepted, result.Status);
        Assert.NotNull(scenario.Booking.DepositPaymentConfirmedAt);
        Assert.Equal(scenario.Booking.DepositPaymentConfirmedAt, result.DepositPaymentConfirmedAt);
        Assert.Equal(
            [HallSlotStatus.Booked, HallSlotStatus.Booked],
            scenario.Slots().Values);
    }

    [Fact]
    public async Task ConfirmPayment_ApprovedBooking_ReturnsTheHoursAndRangeSoTheOwnerCanVerify()
    {
        var scenario = Scenario(BookingStatus.Accepted, depositAmount: 250m);

        var result = await scenario.Service.ConfirmPaymentAsync(scenario.Hall.Id, scenario.Booking.Id);

        Assert.Equal(scenario.Booking.Id, result.BookingId);
        Assert.Equal(scenario.Hall.Id, result.HallId);
        Assert.Equal(RequesterId, result.RequesterUserId);
        Assert.Equal(BookingDate, result.Date);
        Assert.Equal(scenario.Booking.HourlyTimeRange, result.TimeRange);
    }

    [Fact]
    public async Task ConfirmPayment_CalledTwice_ThrowsConflict()
    {
        // Paying twice would be a real double-charge, so the second attempt must not silently
        // re-stamp or re-promote anything.
        var scenario = Scenario(BookingStatus.Accepted, depositAmount: 500m);
        await scenario.Service.ConfirmPaymentAsync(scenario.Hall.Id, scenario.Booking.Id);

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.ConfirmPaymentAsync(scenario.Hall.Id, scenario.Booking.Id));
    }

    [Fact]
    public async Task ConfirmPayment_AlreadyPaidBooking_ThrowsConflictAndLeavesHoursBooked()
    {
        var scenario = Scenario(
            BookingStatus.Accepted,
            depositAmount: 500m,
            depositPaymentConfirmedAt: DateTimeOffset.UtcNow);

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.ConfirmPaymentAsync(scenario.Hall.Id, scenario.Booking.Id));

        // Pre-existing confirmed state must be reported as such, not re-processed.
        Assert.Equal(
            [HallSlotStatus.Reserved, HallSlotStatus.Reserved],
            scenario.Slots().Values);
    }

    [Fact]
    public async Task ConfirmPayment_BookingLostItsReservedHours_ThrowsConflictAndRollsBackThePayment()
    {
        // The booking was rejected or cancelled between approval and payment, so its hours went
        // back on sale. Confirming now would charge a requester for a hall nobody is holding
        // for them, so the whole transaction must unwind: no payment stamp, no Booked hours.
        var scenario = Scenario(BookingStatus.Accepted, depositAmount: 500m);
        scenario.SlotStore.Seed(scenario.Hall.Id, BookingDate, SecondStart, HallSlotStatus.Available);

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.ConfirmPaymentAsync(scenario.Hall.Id, scenario.Booking.Id));

        // Nothing may survive a refused confirmation. 11:00 was already lost, and 10:00 must be
        // put back exactly as it was (Reserved) rather than left Booked, so a retry after the
        // owner re-holds both hours can still succeed.
        Assert.Null(scenario.Booking.DepositPaymentConfirmedAt);
        Assert.Equal(BookingStatus.Accepted, scenario.Booking.Status);
        Assert.Equal(
            [HallSlotStatus.Reserved, HallSlotStatus.Available],
            scenario.Slots().Values);
        Assert.True(scenario.UnitOfWork.RolledBack);
    }

    [Fact]
    public async Task ConfirmPayment_StoreFailsMidTransaction_RollsBackEverything()
    {
        var scenario = Scenario(BookingStatus.Accepted, depositAmount: 500m);
        scenario.UnitOfWork.ThrowOnSave = true;

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            scenario.Service.ConfirmPaymentAsync(scenario.Hall.Id, scenario.Booking.Id));

        Assert.Null(scenario.Booking.DepositPaymentConfirmedAt);
        Assert.Equal(
            [HallSlotStatus.Reserved, HallSlotStatus.Reserved],
            scenario.Slots().Values);
    }

    [Fact]
    public async Task ConfirmPayment_PendingBooking_ThrowsConflictTellingTheOwnerToApproveFirst()
    {
        // A deposit cannot exist for a request that was never approved, so this is a usage
        // error and the message has to say what to do instead of just failing.
        var scenario = Scenario(BookingStatus.Pending);

        var exception = await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.ConfirmPaymentAsync(scenario.Hall.Id, scenario.Booking.Id));

        Assert.Contains("not been approved", exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Null(scenario.Booking.DepositPaymentConfirmedAt);
    }

    [Fact]
    public async Task ConfirmPayment_RejectedBooking_ThrowsConflict()
    {
        var scenario = Scenario(BookingStatus.Rejected);

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.ConfirmPaymentAsync(scenario.Hall.Id, scenario.Booking.Id));

        Assert.Null(scenario.Booking.DepositPaymentConfirmedAt);
    }

    [Fact]
    public async Task ConfirmPayment_CancelledBooking_ThrowsConflict()
    {
        var scenario = Scenario(BookingStatus.Cancelled);

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.ConfirmPaymentAsync(scenario.Hall.Id, scenario.Booking.Id));

        Assert.Null(scenario.Booking.DepositPaymentConfirmedAt);
    }

    [Fact]
    public async Task ConfirmPayment_UnknownBooking_ThrowsNotFound()
    {
        var scenario = Scenario(BookingStatus.Accepted, depositAmount: 500m);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            scenario.Service.ConfirmPaymentAsync(scenario.Hall.Id, Guid.NewGuid()));
    }

    [Fact]
    public async Task ConfirmPayment_BookingBelongsToAnotherHall_ThrowsNotFound()
    {
        // The route carries the hall id, so a mismatched pair must not confirm the booking:
        // reporting it as not-found avoids leaking that the id exists at all.
        var scenario = Scenario(BookingStatus.Accepted, depositAmount: 500m);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            scenario.Service.ConfirmPaymentAsync(Guid.NewGuid(), scenario.Booking.Id));

        Assert.Null(scenario.Booking.DepositPaymentConfirmedAt);
    }

    [Fact]
    public async Task ConfirmPayment_SoftDeletedHall_ThrowsNotFound()
    {
        var scenario = Scenario(BookingStatus.Accepted, depositAmount: 500m);
        scenario.Hall.IsDeleted = true;

        await Assert.ThrowsAsync<NotFoundException>(() =>
            scenario.Service.ConfirmPaymentAsync(scenario.Hall.Id, scenario.Booking.Id));

        Assert.Null(scenario.Booking.DepositPaymentConfirmedAt);
    }

    [Fact]
    public async Task ConfirmPayment_AdminLockedHall_ThrowsBusinessRule()
    {
        // A locked hall must not be able to move its own bookings, exactly like approval,
        // rejection and deletion: all four share HallManagementAccess.
        var scenario = Scenario(BookingStatus.Accepted, depositAmount: 500m);
        scenario.Hall.IsAdminLocked = true;

        await Assert.ThrowsAsync<BusinessRuleException>(() =>
            scenario.Service.ConfirmPaymentAsync(scenario.Hall.Id, scenario.Booking.Id));

        Assert.Null(scenario.Booking.DepositPaymentConfirmedAt);
        Assert.Equal(
            [HallSlotStatus.Reserved, HallSlotStatus.Reserved],
            scenario.Slots().Values);
    }

    [Fact]
    public async Task ConfirmPayment_UnpaidHallSubscription_ThrowsBusinessRule()
    {
        var scenario = Scenario(BookingStatus.Accepted, depositAmount: 500m);
        scenario.Hall.PaymentStatus = HallPaymentStatus.Unpaid;

        await Assert.ThrowsAsync<BusinessRuleException>(() =>
            scenario.Service.ConfirmPaymentAsync(scenario.Hall.Id, scenario.Booking.Id));

        Assert.Null(scenario.Booking.DepositPaymentConfirmedAt);
    }

    [Fact]
    public async Task ConfirmPayment_SystemLockedHall_ThrowsBusinessRule()
    {
        var scenario = Scenario(BookingStatus.Accepted, depositAmount: 500m);
        scenario.Hall.SystemLocked = true;

        await Assert.ThrowsAsync<BusinessRuleException>(() =>
            scenario.Service.ConfirmPaymentAsync(scenario.Hall.Id, scenario.Booking.Id));

        Assert.Null(scenario.Booking.DepositPaymentConfirmedAt);
    }

    [Fact]
    public async Task ConfirmPayment_AnonymousCaller_ThrowsUnauthorized()
    {
        var scenario = Scenario(BookingStatus.Accepted, depositAmount: 500m, isAuthenticated: false);

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            scenario.Service.ConfirmPaymentAsync(scenario.Hall.Id, scenario.Booking.Id));

        Assert.Null(scenario.Booking.DepositPaymentConfirmedAt);
    }

    [Fact]
    public async Task ConfirmPayment_NonOwnerRole_ThrowsForbidden()
    {
        // A requester who is also signed in must not be able to confirm their own payment;
        // only the owner of the hall may declare the money received.
        var scenario = Scenario(
            BookingStatus.Accepted,
            depositAmount: 500m,
            userId: RequesterId,
            roles: [ApplicationRoles.RegisteredUser]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            scenario.Service.ConfirmPaymentAsync(scenario.Hall.Id, scenario.Booking.Id));

        Assert.Null(scenario.Booking.DepositPaymentConfirmedAt);
    }

    [Fact]
    public async Task ConfirmPayment_AnotherOwner_ThrowsForbidden()
    {
        // Two hall owners: being an owner is not enough, it has to be this hall's owner.
        var scenario = Scenario(
            BookingStatus.Accepted,
            depositAmount: 500m,
            userId: "owner-2",
            roles: [ApplicationRoles.HallOwner]);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            scenario.Service.ConfirmPaymentAsync(scenario.Hall.Id, scenario.Booking.Id));

        Assert.Null(scenario.Booking.DepositPaymentConfirmedAt);
    }

    [Fact]
    public async Task ConfirmPayment_SecondOwnerCallAfterFirstSucceeds_ThrowsConflict()
    {
        // Two owners pressing the button at once: the conditional UPDATE is the real gate, so
        // exactly one call can win no matter how the reads interleaved.
        var scenario = Scenario(BookingStatus.Accepted, depositAmount: 500m);
        await scenario.Service.ConfirmPaymentAsync(scenario.Hall.Id, scenario.Booking.Id);

        await Assert.ThrowsAsync<ConflictException>(() =>
            scenario.Service.ConfirmPaymentAsync(scenario.Hall.Id, scenario.Booking.Id));

        Assert.Equal(
            [HallSlotStatus.Booked, HallSlotStatus.Booked],
            scenario.Slots().Values);
    }

    private static ScenarioContext Scenario(
        BookingStatus status,
        decimal? depositAmount = null,
        DateTimeOffset? depositPaymentConfirmedAt = null,
        string userId = OwnerId,
        IReadOnlyList<string>? roles = null,
        bool isAuthenticated = true)
    {
        var hall = new Hall
        {
            Id = Guid.NewGuid(),
            Name = "Grand Hall",
            Status = HallStatus.Approved,
            // A hall can only manage its bookings once its own subscription is paid, so this
            // is the baseline for the owner-side tests below.
            PaymentStatus = HallPaymentStatus.Paid,
            OwnerId = OwnerId
        };

        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            Hall = hall,
            RequesterUserId = RequesterId,
            Date = BookingDate,
            Status = status,
            DepositAmount = depositAmount,
            DepositPaymentConfirmedAt = depositPaymentConfirmedAt,
            Slots =
            [
                new BookingSlot { StartTime = Start, EndTime = Start.AddHours(1) },
                new BookingSlot { StartTime = SecondStart, EndTime = SecondStart.AddHours(1) }
            ]
        };

        var slotStore = new FakeHourlySlotStore();
        slotStore.Bookings.Add(booking);

        // Approval leaves the hours Reserved; nothing is Booked until this service runs. Seeding
        // anything else is a test's way of describing a booking that lost the hold.
        slotStore.Seed(hall.Id, BookingDate, Start, HallSlotStatus.Reserved);
        slotStore.Seed(hall.Id, BookingDate, SecondStart, HallSlotStatus.Reserved);

        var unitOfWork = new FakeUnitOfWork(slotStore);

        return new ScenarioContext
        {
            Hall = hall,
            Booking = booking,
            SlotStore = slotStore,
            UnitOfWork = unitOfWork,
            Service = new BookingPaymentConfirmationService(
                slotStore,
                unitOfWork,
                new FakeCurrentUserService(userId, isAuthenticated, roles ?? [ApplicationRoles.HallOwner]))
        };
    }

    private sealed class ScenarioContext
    {
        public required Hall Hall { get; init; }

        public required Booking Booking { get; init; }

        public required FakeHourlySlotStore SlotStore { get; init; }

        public required FakeUnitOfWork UnitOfWork { get; init; }

        public required BookingPaymentConfirmationService Service { get; init; }

        public Dictionary<TimeOnly, HallSlotStatus> Slots() => SlotStore.SlotsFor(Hall.Id, BookingDate);
    }

    /// <summary>
    /// Stands in for the database transaction: it restores both the booking row and the slot
    /// rows when the body throws, which is what makes the atomicity assertions meaningful.
    /// </summary>
    private sealed class FakeUnitOfWork : IUnitOfWork
    {
        private readonly FakeHourlySlotStore _slotStore;

        public FakeUnitOfWork(FakeHourlySlotStore slotStore)
        {
            _slotStore = slotStore;
        }

        public bool ThrowOnSave { get; set; }

        public bool RolledBack { get; set; }

        public async Task<TResult> ExecuteInTransactionAsync<TResult>(
            Func<Task<TResult>> operation,
            CancellationToken cancellationToken = default)
        {
            var bookingSnapshot = _slotStore.Bookings
                .Select(booking => new BookingSnapshot(
                    booking.Id,
                    booking.Status,
                    booking.DepositPaymentConfirmedAt))
                .ToList();
            var slotSnapshot = _slotStore.SnapshotSlots();

            try
            {
                return await operation();
            }
            catch
            {
                foreach (var item in bookingSnapshot)
                {
                    var booking = _slotStore.Bookings.FirstOrDefault(candidate => candidate.Id == item.Id);

                    if (booking is not null)
                    {
                        booking.Status = item.Status;
                        booking.DepositPaymentConfirmedAt = item.DepositPaymentConfirmedAt;
                    }
                }

                _slotStore.RestoreSlots(slotSnapshot);
                RolledBack = true;
                throw;
            }
        }

        public Task ExecuteInTransactionAsync(Func<Task> operation, CancellationToken cancellationToken = default)
            => ExecuteInTransactionAsync<byte>(async () =>
            {
                await operation();
                return 0;
            }, cancellationToken);

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
            => ThrowOnSave
                ? throw new InvalidOperationException("The save failed.")
                : Task.FromResult(1);
    }

    private sealed record BookingSnapshot(Guid Id, BookingStatus Status, DateTimeOffset? DepositPaymentConfirmedAt);

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
