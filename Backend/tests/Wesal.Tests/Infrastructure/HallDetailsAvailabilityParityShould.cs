using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.Bookings;
using Wesal.Infrastructure.Halls;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// WESAL-TASK-5, Edit 5: the public hall-details view must show the same day/hour data as
/// the dedicated hourly endpoints, and must honour the owner's ShowBookedSlots toggle.
///
/// These tests wire the real <see cref="HourlySlotService"/> (not the fake) underneath
/// <see cref="HallDetailsService"/> so the parity is checked against the actual booking
/// rules rather than against a stand-in that could agree with a broken implementation.
/// Each case compares the details response against
/// <c>GetHourlyCatalogAsync</c> - the exact method the hourly-catalog endpoint calls.
/// </summary>
public class HallDetailsAvailabilityParityShould
{
    private static readonly DateTimeOffset FixedNow = new(2026, 8, 6, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task GetHallDetailsAsync_MatchesHourlyCatalog_WhenShowBookedSlotsIsOn()
    {
        // With the toggle ON, booked hours are shown and flagged Booked. The details view
        // must report them identically to the dedicated hourly endpoint, otherwise a
        // seeker would see an hour as bookable on one endpoint and taken on the other.
        var hall = CreateHall(showBookedSlots: true);
        var date = new DateOnly(2026, 8, 10);
        var setup = CreateSubject(hall, [new TimeOnly(10, 0)], dayOpen: true);

        var catalog = await setup.HourlySlots.GetHourlyCatalogAsync(hall.Id, date);
        var details = await setup.Details.GetHallDetailsAsync(hall.Id);
        var day = details.Availability.Single(item => item.Date == date);

        Assert.Equal(2, catalog.Slots.Count);
        Assert.Equal(
            [(new TimeOnly(10, 0), HallSlotStatus.Booked), (new TimeOnly(11, 0), HallSlotStatus.Available)],
            catalog.Slots.Select(slot => (slot.StartTime, slot.Status)).ToArray());
        Assert.Equal(catalog.DayOpen, day.DayOpen);
        Assert.Equal(
            catalog.Slots.Select(slot => (slot.StartTime, slot.EndTime, slot.Status)),
            day.Slots.Select(slot => (slot.StartTime, slot.EndTime, slot.Status)));
    }

    [Fact]
    public async Task GetHallDetailsAsync_MatchesHourlyCatalog_WhenShowBookedSlotsIsOff()
    {
        // With the toggle OFF, booked hours are omitted entirely. The details view must
        // omit exactly the same hours - neither leaking a booked slot nor hiding a free one.
        var hall = CreateHall(showBookedSlots: false);
        var date = new DateOnly(2026, 8, 10);
        var setup = CreateSubject(hall, [new TimeOnly(10, 0)], dayOpen: true);

        var catalog = await setup.HourlySlots.GetHourlyCatalogAsync(hall.Id, date);
        var details = await setup.Details.GetHallDetailsAsync(hall.Id);
        var day = details.Availability.Single(item => item.Date == date);

        Assert.Equal(catalog.DayOpen, day.DayOpen);
        Assert.Equal(
            catalog.Slots.Select(slot => (slot.StartTime, slot.EndTime, slot.Status)),
            day.Slots.Select(slot => (slot.StartTime, slot.EndTime, slot.Status)));
        Assert.DoesNotContain(day.Slots, slot => slot.Status == HallSlotStatus.Booked);

        // The booked 10:00 hour is gone and only the free 11:00 hour survives, so the
        // toggle neither leaks the reservation nor drops an hour the seeker can take.
        Assert.Equal(
            [(new TimeOnly(11, 0), HallSlotStatus.Available)],
            day.Slots.Select(slot => (slot.StartTime, slot.Status)).ToArray());
    }

    [Fact]
    public async Task GetHallDetailsAsync_MatchesHourlyCatalog_ForEveryDayItRenders()
    {
        // A stronger form of the same guarantee: walk the whole window the details view
        // emits and hold each day against the dedicated endpoint's own answer.
        var hall = CreateHall(showBookedSlots: true);
        var setup = CreateSubject(hall, [new TimeOnly(10, 0), new TimeOnly(11, 0)], dayOpen: true);

        var details = await setup.Details.GetHallDetailsAsync(hall.Id);

        Assert.NotEmpty(details.Availability);
        foreach (var day in details.Availability)
        {
            var catalog = await setup.HourlySlots.GetHourlyCatalogAsync(hall.Id, day.Date);
            Assert.Equal(catalog.DayOpen, day.DayOpen);
            Assert.Equal(
                catalog.Slots.Select(slot => (slot.StartTime, slot.EndTime, slot.Status)),
                day.Slots.Select(slot => (slot.StartTime, slot.EndTime, slot.Status)));
        }
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task GetHallDetailsAsync_MatchesHourlyCatalog_ForABlockedDay(bool showBookedSlots)
    {
        // A day the owner blocked is the case Edit 5 had to fix: the dedicated endpoint
        // discloses it as DayOpen=false when ShowBookedSlots is ON, and deliberately hides
        // the block (DayOpen=true, no slots) when OFF so a seeker cannot tell a blocked
        // day from a fully-booked one. The details view has to reproduce whichever the
        // dedicated endpoint reports, including hiding the block in the OFF case.
        var hall = CreateHall(showBookedSlots);
        var date = new DateOnly(2026, 8, 10);
        var setup = CreateSubject(hall, [], dayOpen: false);

        var catalog = await setup.HourlySlots.GetHourlyCatalogAsync(hall.Id, date);
        var details = await setup.Details.GetHallDetailsAsync(hall.Id);
        var day = details.Availability.Single(item => item.Date == date);

        Assert.Equal(showBookedSlots ? false : true, catalog.DayOpen);
        Assert.Equal(catalog.DayOpen, day.DayOpen);
        Assert.Empty(catalog.Slots);
        Assert.Empty(day.Slots);
    }

    [Fact]
    public async Task GetHallDetailsAsync_HonoursTheOwnersHourlyWindow()
    {
        // The window the owner saved on the hall drives the hours the details view offers.
        // Before Edit 5 the response did not carry the window at all, so a client could see
        // hours with no way to explain which window they came from.
        var hall = CreateHall(showBookedSlots: true);
        hall.HourlySlotStart = new TimeOnly(9, 0);
        hall.HourlySlotEnd = new TimeOnly(12, 0);
        var date = new DateOnly(2026, 8, 10);
        var setup = CreateSubject(hall, [], dayOpen: true);

        var details = await setup.Details.GetHallDetailsAsync(hall.Id);

        Assert.Equal(new TimeOnly(9, 0), details.HourlySlotStart);
        Assert.Equal(new TimeOnly(12, 0), details.HourlySlotEnd);
        Assert.Equal(
            [new TimeOnly(9, 0), new TimeOnly(10, 0), new TimeOnly(11, 0)],
            details.Availability.Single(item => item.Date == date).Slots.Select(slot => slot.StartTime));
    }

    [Fact]
    public async Task GetHallDetailsAsync_BlockedDay_StaysInvisible_WhenShowBookedSlotsIsOff()
    {
        // Regression guard on the privacy half of the rule: with the toggle OFF, a blocked
        // day must be indistinguishable from a fully-booked one in the details view too,
        // not just on the dedicated endpoint.
        var hall = CreateHall(showBookedSlots: false);
        var date = new DateOnly(2026, 8, 10);
        var setup = CreateSubject(hall, [], dayOpen: false);

        var details = await setup.Details.GetHallDetailsAsync(hall.Id);
        var day = details.Availability.Single(item => item.Date == date);

        Assert.True(day.DayOpen);
        Assert.Empty(day.Slots);
    }

    private static (HallDetailsService Details, HourlySlotService HourlySlots) CreateSubject(
        Hall hall,
        IReadOnlyList<TimeOnly> bookedStarts,
        bool dayOpen)
    {        var halls = new StubHallRepository(hall);
        var bookings = new StubBookingRepository(bookedStarts, dayOpen);
        var currentUser = new StubCurrentUserService();
        var hourlySlots = new HourlySlotService(
            halls,
            bookings,
            new StubUnitOfWork(),
            currentUser);

        var details = new HallDetailsService(
            halls,
            currentUser,
            new FixedDateTime(FixedNow),
            hourlySlots,
            NullLogger<HallDetailsService>.Instance);

        return (details, hourlySlots);
    }

    private static Hall CreateHall(bool showBookedSlots)
        => new()
        {
            Id = Guid.NewGuid(),
            Name = "Parity Hall",
            Region = HallRegion.Gaza,
            Address = "Gaza City",
            Capacity = 200,
            Price = 1500m,
            ShowPrice = true,
            Description = "A beautiful wedding hall.",
            Status = HallStatus.Approved,
            PaymentStatus = HallPaymentStatus.Paid,
            ShowBookedSlots = showBookedSlots,

            // A fixed two-hour window keeps each case readable: the toggle then changes the
            // slot list by exactly one entry, so a leak or an over-filter is obvious
            // instead of hiding in a 13-hour default window.
            HourlySlotStart = new TimeOnly(10, 0),
            HourlySlotEnd = new TimeOnly(12, 0),
            CreatedAt = FixedNow
        };

    private sealed class StubBookingRepository : IBookingRepository
    {
        private readonly IReadOnlyList<TimeOnly> _bookedStarts;
        private readonly bool _dayOpen;

        public StubBookingRepository(IReadOnlyList<TimeOnly> bookedStarts, bool dayOpen)
        {
            _bookedStarts = bookedStarts;
            _dayOpen = dayOpen;
        }

        public Task<bool> IsDayOpenAsync(Guid hallId, DateOnly date, CancellationToken cancellationToken = default)
            => Task.FromResult(_dayOpen);

        public Task<IReadOnlyList<HallSlotAvailability>> GetHourlySlotsAsync(
            Guid hallId,
            DateOnly date,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallSlotAvailability>>(
                _bookedStarts
                    .Select(start => new HallSlotAvailability
                    {
                        Id = Guid.NewGuid(),
                        HallId = hallId,
                        Date = date,
                        StartTime = start,
                        Status = HallSlotStatus.Booked
                    })
                    .ToList());

        // The rest of IBookingRepository is outside the availability read path under test.

        public Task AddAsync(Booking booking, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public Task<Booking?> GetByIdWithHallAsync(Guid bookingId, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public Task<IReadOnlyList<Booking>> GetPendingRejectionNotificationsAsync(
            CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public Task<int> CancelPendingAsync(
            Guid bookingId, string requesterUserId, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public Task<int> AcceptPendingAsync(Guid bookingId, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();

        public Task<int> DeleteAsync(Guid bookingId, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();
    }

    private sealed class StubHallRepository : IHallRepository
    {
        private readonly Hall _hall;

        public StubHallRepository(Hall hall)
        {
            _hall = hall;
        }

        public Task<Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default)
            => Task.FromResult<Hall?>(_hall.Id == id ? _hall : null);

        public Task<IReadOnlyList<Hall>> GetApprovedHallsAsync(int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>([_hall]);

        public Task<IReadOnlyList<Hall>> GetApprovedHallsPaginatedAsync(
            int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>([_hall]);

        public Task<int> GetApprovedHallsCountAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(1);

        public Task<IReadOnlyList<Hall>> SearchApprovedHallsAsync(
            string? name, HallRegion? region, string? area,
            DateOnly? date, TimeOnly? startTime,
            int skip, int take, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>([_hall]);

        public Task<int> SearchApprovedHallsCountAsync(
            string? name, HallRegion? region, string? area,
            DateOnly? date, TimeOnly? startTime,
            CancellationToken cancellationToken = default)
            => Task.FromResult(1);

        public Task<IReadOnlyList<Hall>> GetApprovedHallsByRegionAsync(
            HallRegion region, int count, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Hall>>([_hall]);

        public Task<IReadOnlyList<HallImage>> GetHallImagesAsync(
            Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<HallImage>>([]);
    }

    private sealed class StubUnitOfWork : IUnitOfWork
    {
        public Task<TResult> ExecuteInTransactionAsync<TResult>(
            Func<Task<TResult>> operation, CancellationToken cancellationToken = default)
            => operation();

        public Task ExecuteInTransactionAsync(
            Func<Task> operation, CancellationToken cancellationToken = default)
            => operation();

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(1);
    }

    private sealed class StubCurrentUserService : ICurrentUserService
    {
        public string? UserId => null;

        public string? UserName => null;

        public string? Email => null;

        public bool IsAuthenticated => false;

        public IReadOnlyList<string> Roles => [];
    }

    private sealed class FixedDateTime : IDateTime
    {
        public FixedDateTime(DateTimeOffset now)
        {
            Now = now;
        }

        public DateTimeOffset Now { get; }
    }
}
