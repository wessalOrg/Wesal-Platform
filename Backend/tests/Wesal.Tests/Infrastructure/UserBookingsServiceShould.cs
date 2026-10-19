using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Bookings;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// The seeker-facing "My bookings" read (GET /api/v1/bookings). The contract is that the
/// requester is resolved only from the authenticated session, the response carries the
/// caller's own bookings across every hall and status, and the read never mutates a
/// booking. Exercised against the real <see cref="BookingRepository"/> on an in-memory
/// database so the query itself is covered, not just the service mapping.
/// </summary>
public class UserBookingsServiceShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public UserBookingsServiceShould()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(o => o
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning)));
        services.AddIdentityCore<ApplicationUser>(o =>
        {
            o.Password.RequireDigit = true;
            o.Password.RequireLowercase = true;
            o.Password.RequireUppercase = true;
            o.Password.RequireNonAlphanumeric = true;
            o.Password.RequiredLength = 8;
            o.User.RequireUniqueEmail = true;
        }).AddRoles<ApplicationRole>().AddEntityFrameworkStores<ApplicationDbContext>();
        services.AddLogging();
        _provider = services.BuildServiceProvider();
        _context = _provider.GetRequiredService<ApplicationDbContext>();
        _context.Database.EnsureCreated();
        var roleManager = _provider.GetRequiredService<RoleManager<ApplicationRole>>();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.RegisteredUser)).GetAwaiter().GetResult();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.HallOwner)).GetAwaiter().GetResult();
        _userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
    }

    [Fact]
    public async Task GetMyBookings_Guest_ThrowsUnauthorized()
    {
        var service = CreateService(new FakeCurrentUser(null, false));

        var exception = await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.GetMyBookingsAsync());

        Assert.Contains("logged in", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetMyBookings_NoBookings_ReturnsEmpty()
    {
        var user = await CreateUserAsync("empty@example.com", "+970599300001");
        var service = CreateService(new FakeCurrentUser(user.Id, true));

        var result = await service.GetMyBookingsAsync();

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetMyBookings_ReturnsOnlyTheCallersBookings()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599300002", ApplicationRoles.HallOwner);
        var me = await CreateUserAsync("me@example.com", "+970599300003");
        var other = await CreateUserAsync("other@example.com", "+970599300004");
        var hall = AddHall(owner.Id, "Grand Hall");
        AddBooking(hall, me.Id, new DateOnly(2027, 6, 1), new TimeOnly(10, 0));
        AddBooking(hall, other.Id, new DateOnly(2027, 6, 1), new TimeOnly(11, 0));

        var service = CreateService(new FakeCurrentUser(me.Id, true));

        var item = Assert.Single(await service.GetMyBookingsAsync());
        Assert.Equal(new TimeOnly(10, 0), Assert.Single(item.SlotStarts));
    }

    [Fact]
    public async Task GetMyBookings_ReturnsEveryStatusForTheCaller()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599300005", ApplicationRoles.HallOwner);
        var me = await CreateUserAsync("me@example.com", "+970599300006");
        var hall = AddHall(owner.Id, "Grand Hall");
        AddBooking(hall, me.Id, new DateOnly(2027, 6, 1), new TimeOnly(10, 0), BookingStatus.Pending);
        AddBooking(hall, me.Id, new DateOnly(2027, 6, 2), new TimeOnly(10, 0), BookingStatus.Accepted);
        AddBooking(hall, me.Id, new DateOnly(2027, 6, 3), new TimeOnly(10, 0), BookingStatus.Rejected);
        AddBooking(hall, me.Id, new DateOnly(2027, 6, 4), new TimeOnly(10, 0), BookingStatus.Cancelled);

        var service = CreateService(new FakeCurrentUser(me.Id, true));

        var result = await service.GetMyBookingsAsync();

        Assert.Equal(4, result.Count);
        Assert.Contains(result, item => item.Status == BookingStatus.Pending);
        Assert.Contains(result, item => item.Status == BookingStatus.Accepted);
        Assert.Contains(result, item => item.Status == BookingStatus.Rejected);
        Assert.Contains(result, item => item.Status == BookingStatus.Cancelled);
    }

    [Fact]
    public async Task GetMyBookings_MapsHallNameSlotsTimeRangeAndRejection()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599300007", ApplicationRoles.HallOwner);
        var me = await CreateUserAsync("me@example.com", "+970599300008");
        var hall = AddHall(owner.Id, "Royal Hall");
        var booking = AddBooking(
            hall,
            me.Id,
            new DateOnly(2027, 6, 10),
            new TimeOnly(10, 0),
            BookingStatus.Rejected,
            extraSlotStart: new TimeOnly(11, 0),
            rejectionReason: "Hall is under maintenance");

        var service = CreateService(new FakeCurrentUser(me.Id, true));

        var item = Assert.Single(await service.GetMyBookingsAsync());

        Assert.Equal(booking.Id, item.BookingId);
        Assert.Equal(hall.Id, item.HallId);
        Assert.Equal("Royal Hall", item.HallName);
        Assert.Equal(new DateOnly(2027, 6, 10), item.Date);
        Assert.Equal([new TimeOnly(10, 0), new TimeOnly(11, 0)], item.SlotStarts);
        Assert.Equal("10:00 - 12:00", item.TimeRange);
        Assert.Equal(BookingStatus.Rejected, item.Status);
        Assert.Equal("Hall is under maintenance", item.RejectionReason);
    }

    [Fact]
    public async Task GetMyBookings_NewestDayFirst()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599300009", ApplicationRoles.HallOwner);
        var me = await CreateUserAsync("me@example.com", "+970599300010");
        var hall = AddHall(owner.Id, "Grand Hall");
        AddBooking(hall, me.Id, new DateOnly(2027, 7, 2), new TimeOnly(10, 0));
        AddBooking(hall, me.Id, new DateOnly(2027, 6, 1), new TimeOnly(10, 0));

        var service = CreateService(new FakeCurrentUser(me.Id, true));

        var result = await service.GetMyBookingsAsync();

        Assert.Collection(
            result,
            item => Assert.Equal(new DateOnly(2027, 7, 2), item.Date),
            item => Assert.Equal(new DateOnly(2027, 6, 1), item.Date));
    }

    [Fact]
    public async Task GetMyBookings_DoesNotMutateBookings()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599300011", ApplicationRoles.HallOwner);
        var me = await CreateUserAsync("me@example.com", "+970599300012");
        var hall = AddHall(owner.Id, "Grand Hall");
        var booking = AddBooking(hall, me.Id, new DateOnly(2027, 6, 1), new TimeOnly(10, 0));

        var service = CreateService(new FakeCurrentUser(me.Id, true));
        await service.GetMyBookingsAsync();

        var persisted = _context.Bookings
            .AsNoTracking()
            .Include(item => item.Slots)
            .Single(item => item.Id == booking.Id);

        Assert.Equal(BookingStatus.Pending, persisted.Status);
        Assert.Equal(new TimeOnly(10, 0), Assert.Single(persisted.Slots).StartTime);
    }

    [Fact]
    public void GetMyBookings_AcceptsOnlyASessionTokenParameter()
    {
        // The read API must never accept a client-supplied requester identity: the
        // requester is resolved from the authenticated session, so the only parameter is
        // the cancellation token.
        var method = typeof(IUserBookingsService)
            .GetMethod(nameof(IUserBookingsService.GetMyBookingsAsync));
        Assert.NotNull(method);

        var parameters = method!.GetParameters();
        Assert.Single(parameters);
        Assert.Equal(typeof(CancellationToken), parameters[0].ParameterType);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }

    private UserBookingsService CreateService(FakeCurrentUser currentUser)
        => new(new BookingRepository(_context), currentUser);

    private async Task<ApplicationUser> CreateUserAsync(
        string email,
        string phone,
        string role = ApplicationRoles.RegisteredUser)
    {
        var user = new ApplicationUser { FullName = "Regular User", Email = email, UserName = email, PhoneNumber = phone };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded) throw new Exception(string.Join(",", result.Errors.Select(e => e.Description)));
        await _userManager.AddToRoleAsync(user, role);
        return user;
    }

    private Hall AddHall(string ownerId, string name)
    {
        var hall = new Hall
        {
            Name = name,
            Address = "Al-Rashid Street, Gaza",
            Region = HallRegion.Gaza,
            Capacity = 200,
            Price = 1500,
            ShowPrice = true,
            OwnerId = ownerId,
            Status = HallStatus.Approved,
            PaymentStatus = HallPaymentStatus.Paid
        };

        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    private Booking AddBooking(
        Hall hall,
        string requesterUserId,
        DateOnly date,
        TimeOnly slotStart,
        BookingStatus status = BookingStatus.Pending,
        TimeOnly? extraSlotStart = null,
        string? rejectionReason = null)
    {
        var slots = new List<BookingSlot>
        {
            new()
            {
                StartTime = slotStart,
                EndTime = slotStart.AddHours(1)
            }
        };

        if (extraSlotStart is not null)
        {
            slots.Add(new BookingSlot
            {
                StartTime = extraSlotStart.Value,
                EndTime = extraSlotStart.Value.AddHours(1)
            });
        }

        var booking = new Booking
        {
            HallId = hall.Id,
            RequesterUserId = requesterUserId,
            Date = date,
            Slots = slots,
            Status = status,
            RejectionReason = rejectionReason
        };

        _context.Bookings.Add(booking);
        _context.SaveChanges();
        return booking;
    }

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        public FakeCurrentUser(string? userId, bool auth)
        {
            UserId = userId;
            IsAuthenticated = auth;
            Roles = userId is null ? [] : [ApplicationRoles.RegisteredUser];
        }

        public string? UserId { get; }

        public string? UserName => "test";

        public string? Email => "test@example.com";

        public bool IsAuthenticated { get; }

        public IReadOnlyList<string> Roles { get; }
    }
}
