using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.InMemory;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Bookings;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Persistence;

public class BookingRequestFlowShould
{
    private static readonly DateOnly BookingDate = new(2035, 6, 1);

    [Fact]
    public async Task Submit_SinglePeriod_PersistsBookingAndReservesAvailability()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            SeedPeriods(seedingContext, hall, BookingPeriodType.FirstPeriod);
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "user-1", [Wesal.Domain.Constants.ApplicationRoles.RegisteredUser]);

            var result = await service.CreateBookingRequestAsync(
                CreateRequest(hallId, [BookingPeriodType.FirstPeriod]));

            Assert.Equal(hallId, result.HallId);
            Assert.Equal("user-1", result.RequesterUserId);
            var item = Assert.Single(result.Periods);
            Assert.Equal(BookingPeriodType.FirstPeriod, item.Period);
            Assert.Equal(BookingStatus.Pending, item.Status);

            var booking = Assert.Single(context.Bookings.ToList());
            Assert.Equal(hallId, booking.HallId);
            Assert.Equal("user-1", booking.RequesterUserId);
            Assert.Equal(BookingDate, booking.Date);
            Assert.Equal(BookingPeriodType.FirstPeriod, booking.Period);
            Assert.Equal(BookingStatus.Pending, booking.Status);

            var availability = Assert.Single(context.HallAvailabilities.ToList());
            Assert.Equal(AvailabilityStatus.Booked, availability.Status);
        }
    }

    [Fact]
    public async Task Submit_BothPeriods_PersistsTwoBookingsAndTwoReservations()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            SeedPeriods(seedingContext, hall, BookingPeriodType.FirstPeriod, BookingPeriodType.SecondPeriod);
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "user-1", [Wesal.Domain.Constants.ApplicationRoles.RegisteredUser]);

            var result = await service.CreateBookingRequestAsync(
                CreateRequest(hallId, [BookingPeriodType.FirstPeriod, BookingPeriodType.SecondPeriod]));

            Assert.Equal(2, result.Periods.Count);
            Assert.Equal(2, context.Bookings.Count());
            Assert.Equal(2, context.HallAvailabilities.Count());
        }
    }

    [Fact]
    public async Task Submit_TakenSecondPeriod_ThrowsConflictAndPersistsNoBooking()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            SeedPeriods(seedingContext, hall, BookingPeriodType.FirstPeriod, BookingPeriodType.SecondPeriod);
            SeedAvailability(seedingContext, hall, BookingDate, BookingPeriodType.SecondPeriod, AvailabilityStatus.Booked);
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "user-1", [Wesal.Domain.Constants.ApplicationRoles.RegisteredUser]);

            await Assert.ThrowsAsync<ConflictException>(() =>
                service.CreateBookingRequestAsync(
                    CreateRequest(hallId, [BookingPeriodType.FirstPeriod, BookingPeriodType.SecondPeriod])));

            Assert.Empty(context.Bookings);
            var secondPeriod = context.HallAvailabilities.Single(availability => availability.PeriodType == BookingPeriodType.SecondPeriod);
            Assert.Equal(AvailabilityStatus.Booked, secondPeriod.Status);
        }
    }

    [Fact]
    public async Task Submit_AlreadyBookedPeriod_AnotherRequester_ThrowsConflict()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            SeedPeriods(seedingContext, hall, BookingPeriodType.FirstPeriod);
            SeedBooking(seedingContext, hall, "user-0", BookingDate, BookingPeriodType.FirstPeriod);
            SeedAvailability(seedingContext, hall, BookingDate, BookingPeriodType.FirstPeriod, AvailabilityStatus.Booked);
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "user-1", [Wesal.Domain.Constants.ApplicationRoles.RegisteredUser]);

            await Assert.ThrowsAsync<ConflictException>(() =>
                service.CreateBookingRequestAsync(
                    CreateRequest(hallId, [BookingPeriodType.FirstPeriod])));

            var only = Assert.Single(context.Bookings.ToList());
            Assert.Equal("user-0", only.RequesterUserId);
        }
    }

    [Fact]
    public async Task Submit_PastDate_ThrowsValidationAndPersistsNothing()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            SeedPeriods(seedingContext, hall, BookingPeriodType.FirstPeriod);
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "user-1", [Wesal.Domain.Constants.ApplicationRoles.RegisteredUser]);

            await Assert.ThrowsAsync<ValidationException>(() =>
                service.CreateBookingRequestAsync(
                    new BookingRequestDto
                    {
                        HallId = hallId,
                        Date = new DateOnly(2020, 1, 1),
                        Periods = [BookingPeriodType.FirstPeriod]
                    }));

            Assert.Empty(context.Bookings);
            Assert.Empty(context.HallAvailabilities);
        }
    }

    [Fact]
    public async Task Submit_UnconfiguredPeriod_ThrowsValidationAndPersistsNothing()
    {
        var databaseName = Guid.NewGuid().ToString();
        var hallId = Guid.NewGuid();

        await using (var seedingContext = CreateContext(databaseName))
        {
            var hall = SeedHall(seedingContext, hallId);
            SeedPeriods(seedingContext, hall, BookingPeriodType.FirstPeriod);
        }

        await using (var context = CreateContext(databaseName))
        {
            var service = CreateService(context, "user-1", [Wesal.Domain.Constants.ApplicationRoles.RegisteredUser]);

            await Assert.ThrowsAsync<ValidationException>(() =>
                service.CreateBookingRequestAsync(
                    CreateRequest(hallId, [BookingPeriodType.SecondPeriod])));

            Assert.Empty(context.Bookings);
        }
    }

    private static BookingRequestService CreateService(
        ApplicationDbContext context,
        string userId,
        string[] roles)
        => new(
            new HallRepository(context),
            new FakeCurrentUserService(userId, roles),
            new BookingRepository(context),
            new UnitOfWork(context));

    private static BookingRequestDto CreateRequest(Guid hallId, IReadOnlyList<BookingPeriodType> periods)
        => new()
        {
            HallId = hallId,
            Date = BookingDate,
            Periods = periods
        };

    private static Hall SeedHall(ApplicationDbContext context, Guid id)
    {
        var hall = new Hall
        {
            Id = id,
            Name = "Grand Hall",
            Status = HallStatus.Approved,
            OwnerId = "owner-1"
        };

        context.Halls.Add(hall);
        context.SaveChanges();

        return hall;
    }

    private static void SeedPeriods(ApplicationDbContext context, Hall hall, params BookingPeriodType[] types)
    {
        foreach (var type in types)
        {
            context.HallBookingPeriods.Add(new HallBookingPeriod
            {
                HallId = hall.Id,
                Type = type,
                StartTime = new TimeOnly(9, 0),
                EndTime = new TimeOnly(12, 0)
            });
        }

        context.SaveChanges();
    }

    private static void SeedAvailability(
        ApplicationDbContext context,
        Hall hall,
        DateOnly date,
        BookingPeriodType periodType,
        AvailabilityStatus status)
    {
        context.HallAvailabilities.Add(new HallAvailability
        {
            HallId = hall.Id,
            Date = date,
            PeriodType = periodType,
            Status = status
        });

        context.SaveChanges();
    }

    private static void SeedBooking(
        ApplicationDbContext context,
        Hall hall,
        string requesterUserId,
        DateOnly date,
        BookingPeriodType period,
        BookingStatus status = BookingStatus.Pending)
    {
        context.Bookings.Add(new Booking
        {
            HallId = hall.Id,
            RequesterUserId = requesterUserId,
            Date = date,
            Period = period,
            Status = status
        });

        context.SaveChanges();
    }

    private static ApplicationDbContext CreateContext(string databaseName)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName)
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new ApplicationDbContext(options);
    }

    private sealed class FakeCurrentUserService : ICurrentUserService
    {
        public FakeCurrentUserService(string userId, params string[] roles)
        {
            UserId = userId;
            Roles = roles;
        }

        public string? UserId { get; }

        public string? UserName => "testuser";

        public string? Email => "test@example.com";

        public bool IsAuthenticated => true;

        public IReadOnlyList<string> Roles { get; }
    }
}