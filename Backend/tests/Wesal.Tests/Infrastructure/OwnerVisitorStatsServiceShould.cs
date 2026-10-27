using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.OwnerDashboard;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

public sealed class OwnerVisitorStatsServiceShould : IDisposable
{
    private static readonly DateTimeOffset Now = new(2026, 10, 15, 12, 0, 0, TimeSpan.Zero);
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _db;
    private readonly UserManager<ApplicationUser> _users;

    public OwnerVisitorStatsServiceShould()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(options => options.UseInMemoryDatabase(Guid.NewGuid().ToString()));
        services.AddIdentityCore<ApplicationUser>().AddRoles<ApplicationRole>().AddEntityFrameworkStores<ApplicationDbContext>();
        services.AddLogging();
        _provider = services.BuildServiceProvider();
        _db = _provider.GetRequiredService<ApplicationDbContext>();
        _users = _provider.GetRequiredService<UserManager<ApplicationUser>>();
    }

    [Fact]
    public async Task GetVisitorStats_AggregatesAllFourDashboardCardsFromPersistedOwnerData()
    {
        var owner = await CreateOwnerAsync();
        var hall = AddHall(owner.Id, "Owner hall");
        SeedHallActivity(hall.Id, "seeker", new DateTimeOffset(2026, 10, 2, 0, 0, 0, TimeSpan.Zero));

        var stats = await CreateService(owner.Id).GetVisitorStatsAsync();

        Assert.Equal(2, stats.VisitsThisMonth);
        Assert.Equal(1, stats.VisitsPreviousMonth);
        Assert.Equal(1, stats.FavoritesThisMonth);
        Assert.Equal(3, stats.BookingRequestsThisMonth); // Rejected requests still count as submitted requests.
        Assert.Equal(150d, stats.ConversionRateThisMonth); // Request count is not a unique-viewer conversion.
        Assert.Equal(3, stats.TotalActiveBookingsThisMonth);
        Assert.Equal(4, stats.TotalBookedHoursThisMonth);
        Assert.Equal(1, Assert.Single(stats.BookingsByWeekday, item => item.Key == "friday").Count);
        Assert.Equal(1, Assert.Single(stats.BookingsByWeekday, item => item.Key == "saturday").Count);
        Assert.Equal(2, Assert.Single(stats.BookedHoursByPeriod, item => item.Key == "evening").Count);
        Assert.Equal(1, Assert.Single(stats.BookedHoursByPeriod, item => item.Key == "morning").Count);
        Assert.Equal(1, Assert.Single(stats.BookedHoursByPeriod, item => item.Key == "afternoon").Count);
        Assert.Equal(1, Assert.Single(stats.BookingsByOccasionType, item => item.Key == "wedding").Count);
        Assert.Equal(1, Assert.Single(stats.BookingsByOccasionType, item => item.Key == "family").Count);
        Assert.Equal(1, Assert.Single(stats.BookingsByOccasionType, item => item.Key == "social").Count);
    }

    [Fact]
    public async Task GetVisitorStats_ScopesEveryCardToTheSelectedOwnedHall()
    {
        var owner = await CreateOwnerAsync();
        var hallA = AddHall(owner.Id, "Hall A");
        var hallB = AddHall(owner.Id, "Hall B");
        SeedHallActivity(hallA.Id, "seeker-a", new DateTimeOffset(2026, 10, 2, 0, 0, 0, TimeSpan.Zero));
        SeedHallActivity(hallB.Id, "seeker-b", new DateTimeOffset(2026, 10, 3, 0, 0, 0, TimeSpan.Zero));

        var stats = await CreateService(owner.Id).GetVisitorStatsAsync(hallA.Id);

        Assert.Equal(2, stats.VisitsThisMonth);
        Assert.Equal(1, stats.FavoritesThisMonth);
        Assert.Equal(3, stats.BookingRequestsThisMonth);
        Assert.Equal(3, stats.TotalActiveBookingsThisMonth);
        Assert.Contains(stats.BookingsByOccasionType, item => item.Key == "social");
    }

    public void Dispose()
    {
        _db.Database.EnsureDeleted();
        _db.Dispose();
        _provider.Dispose();
    }

    private OwnerVisitorStatsService CreateService(string ownerId)
        => new(_users, new FakeCurrentUser(ownerId), new OwnerDashboardRepository(_db), new HallRepository(_db),
            new HallPageViewRepository(_db), new HallFavoriteRepository(_db), new BookingRepository(_db),
            new FakeDateTime(Now), NullLogger<OwnerVisitorStatsService>.Instance);

    private async Task<ApplicationUser> CreateOwnerAsync()
    {
        var user = new ApplicationUser { UserName = $"owner-{Guid.NewGuid():N}@example.com", Email = $"owner-{Guid.NewGuid():N}@example.com", FullName = "Owner" };
        var result = await _users.CreateAsync(user, "Password123!");
        Assert.True(result.Succeeded, string.Join(", ", result.Errors.Select(error => error.Description)));
        return user;
    }

    private Hall AddHall(string ownerId, string name)
    {
        var hall = new Hall { Name = name, OwnerId = ownerId, Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid };
        _db.Halls.Add(hall);
        _db.SaveChanges();
        return hall;
    }

    private void SeedHallActivity(Guid hallId, string requesterId, DateTimeOffset createdAt)
    {
        _db.HallPageViewEvents.AddRange(
            new HallPageViewEvent { HallId = hallId, ViewedAt = new DateTimeOffset(2026, 10, 5, 0, 0, 0, TimeSpan.Zero) },
            new HallPageViewEvent { HallId = hallId, ViewedAt = new DateTimeOffset(2026, 10, 6, 0, 0, 0, TimeSpan.Zero) },
            new HallPageViewEvent { HallId = hallId, ViewedAt = new DateTimeOffset(2026, 9, 6, 0, 0, 0, TimeSpan.Zero) });
        _db.HallFavorites.AddRange(
            new HallFavorite { Id = Guid.NewGuid(), HallId = hallId, UserId = requesterId, CreatedAt = new DateTimeOffset(2026, 10, 7, 0, 0, 0, TimeSpan.Zero) },
            new HallFavorite { Id = Guid.NewGuid(), HallId = hallId, UserId = requesterId + "-old", CreatedAt = new DateTimeOffset(2026, 9, 7, 0, 0, 0, TimeSpan.Zero) });
        _db.Bookings.AddRange(
            CreateBooking(hallId, requesterId, new DateOnly(2026, 10, 16), new TimeOnly(18, 0), "Guest · Weddings - 0591234567", BookingStatus.Pending, createdAt),
            CreateBooking(hallId, requesterId, new DateOnly(2026, 10, 17), new TimeOnly(8, 0), "Guest · Family occasions - 0591234567", BookingStatus.Accepted, createdAt, new TimeOnly(14, 0)),
            CreateBooking(hallId, requesterId, new DateOnly(2026, 10, 18), new TimeOnly(12, 0), "Guest · Weddings - 0591234567", BookingStatus.Rejected, createdAt));
        _db.Bookings.Add(new Booking
        {
            HallId = hallId, Source = BookingSource.ExternalManual, Date = new DateOnly(2026, 10, 19),
            Status = BookingStatus.Confirmed, CreatedAt = createdAt,
            ExternalDetails = new ExternalBookingDetails { EventType = "مناسبات اجتماعية" },
            Slots = [new BookingSlot { StartTime = new TimeOnly(20, 0), EndTime = new TimeOnly(21, 0) }]
        });
        _db.SaveChanges();
    }

    private static Booking CreateBooking(Guid hallId, string requesterId, DateOnly date, TimeOnly firstSlot,
        string occasion, BookingStatus status, DateTimeOffset createdAt, TimeOnly? secondSlot = null)
    {
        var booking = new Booking
        {
            HallId = hallId, RequesterUserId = requesterId, Date = date, NameOnBooking = occasion,
            Status = status, CreatedAt = createdAt,
            Slots = [new BookingSlot { StartTime = firstSlot, EndTime = firstSlot.AddHours(1) }]
        };
        if (secondSlot.HasValue) booking.Slots.Add(new BookingSlot { StartTime = secondSlot.Value, EndTime = secondSlot.Value.AddHours(1) });
        return booking;
    }

    private sealed class FakeDateTime(DateTimeOffset now) : IDateTime { public DateTimeOffset Now => now; }

    private sealed class FakeCurrentUser(string userId) : ICurrentUserService
    {
        public string? UserId => userId;
        public string? UserName => "owner";
        public string? Email => "owner@example.com";
        public bool IsAuthenticated => true;
        public IReadOnlyList<string> Roles => [];
    }
}
