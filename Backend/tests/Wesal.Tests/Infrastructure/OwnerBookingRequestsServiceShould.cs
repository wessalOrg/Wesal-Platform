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
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.OwnerDashboard;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

public class OwnerBookingRequestsServiceShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public OwnerBookingRequestsServiceShould()
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
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.HallOwner)).GetAwaiter().GetResult();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.RegisteredUser)).GetAwaiter().GetResult();
        _userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
    }

    [Fact]
    public async Task GetBookingRequests_Guest_ThrowsUnauthorized()
    {
        var service = CreateService(new FakeCurrentUser(null, false));

        var exception = await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.GetBookingRequestsAsync(Guid.NewGuid()));

        Assert.Contains("logged in", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetBookingRequests_MissingUserAccount_ThrowsNotFound()
    {
        var service = CreateService(new FakeCurrentUser("not-a-real-id", true));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.GetBookingRequestsAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task GetBookingRequests_UnknownHall_ThrowsNotFound()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599200001", ApplicationRoles.HallOwner);

        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.GetBookingRequestsAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task GetBookingRequests_AnotherOwnersHall_ThrowsNotFound()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599200002", ApplicationRoles.HallOwner);
        var other = await CreateUserAsync("other@example.com", "+970599200003", ApplicationRoles.HallOwner);
        var hall = AddHall(other.Id, "Other's Hall");

        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.GetBookingRequestsAsync(hall.Id));
    }

    [Fact]
    public async Task GetBookingRequests_DeletedHall_ThrowsNotFound()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599200004", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, "Deleted Hall", isDeleted: true);

        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.GetBookingRequestsAsync(hall.Id));
    }

    [Fact]
    public async Task GetBookingRequests_OwnedHallWithoutRequests_ReturnsEmpty()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599200005", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, "Grand Hall");

        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetBookingRequestsAsync(hall.Id);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetBookingRequests_SinglePendingRequest_ReturnsRequestWithServerResolvedRequesterName()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599200006", ApplicationRoles.HallOwner);
        var requester = await CreateUserAsync(
            "requester@example.com",
            "+970599200007",
            ApplicationRoles.RegisteredUser,
            fullName: "Mahmoud Salah");
        var hall = AddHall(owner.Id, "Grand Hall");
        AddBooking(hall, requester.Id, new DateOnly(2027, 6, 1), new TimeOnly(10, 0));

        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var item = Assert.Single(await service.GetBookingRequestsAsync(hall.Id));

        Assert.Equal(hall.Id, item.HallId);
        Assert.Equal(new DateOnly(2027, 6, 1), item.RequestedDate);
        Assert.Contains(new TimeOnly(10, 0), item.SlotStarts);
        Assert.Equal(requester.Id, item.RequesterUserId);
        Assert.Equal("Mahmoud Salah", item.RequesterName);
        Assert.Equal(BookingStatus.Pending, item.Status);
    }

    [Fact]
    public async Task GetBookingRequests_MultipleHourlyRequests_ReturnsOneEntryPerBooking()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599200008", ApplicationRoles.HallOwner);
        var requester = await CreateUserAsync(
            "requester@example.com",
            "+970599200009",
            ApplicationRoles.RegisteredUser,
            fullName: "Sara Ali");
        var hall = AddHall(owner.Id, "Grand Hall");
        AddBooking(hall, requester.Id, new DateOnly(2027, 6, 1), new TimeOnly(10, 0));
        AddBooking(hall, requester.Id, new DateOnly(2027, 6, 1), new TimeOnly(11, 0));

        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetBookingRequestsAsync(hall.Id);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, item =>
            item.SlotStarts.Contains(new TimeOnly(10, 0))
            && item.RequesterName == "Sara Ali"
            && item.RequestedDate == new DateOnly(2027, 6, 1));
        Assert.Contains(result, item =>
            item.SlotStarts.Contains(new TimeOnly(11, 0))
            && item.RequesterName == "Sara Ali"
            && item.RequestedDate == new DateOnly(2027, 6, 1));
    }

    [Fact]
    public async Task GetBookingRequests_CompetingRequests_ReturnsBothWithoutDeduplication()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599200010", ApplicationRoles.HallOwner);
        var firstRequester = await CreateUserAsync(
            "first@example.com",
            "+970599200011",
            ApplicationRoles.RegisteredUser,
            fullName: "First Requester");
        var secondRequester = await CreateUserAsync(
            "second@example.com",
            "+970599200012",
            ApplicationRoles.RegisteredUser,
            fullName: "Second Requester");
        var hall = AddHall(owner.Id, "Grand Hall");
        AddBooking(hall, firstRequester.Id, new DateOnly(2027, 6, 1), new TimeOnly(10, 0));
        AddBooking(hall, secondRequester.Id, new DateOnly(2027, 6, 1), new TimeOnly(10, 0));

        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetBookingRequestsAsync(hall.Id);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, item => item.RequesterUserId == firstRequester.Id && item.RequesterName == "First Requester");
        Assert.Contains(result, item => item.RequesterUserId == secondRequester.Id && item.RequesterName == "Second Requester");
    }

    [Fact]
    public async Task GetBookingRequests_MultipleRequestersAndDates_ReturnsAllWithDeterministicOrdering()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599200013", ApplicationRoles.HallOwner);
        var requester = await CreateUserAsync(
            "requester@example.com",
            "+970599200014",
            ApplicationRoles.RegisteredUser,
            fullName: "Nader Husam");
        var hall = AddHall(owner.Id, "Grand Hall");
        AddBooking(hall, requester.Id, new DateOnly(2027, 7, 2), new TimeOnly(10, 0));
        AddBooking(hall, requester.Id, new DateOnly(2027, 6, 1), new TimeOnly(10, 0));
        AddBooking(hall, requester.Id, new DateOnly(2027, 6, 1), new TimeOnly(11, 0));

        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetBookingRequestsAsync(hall.Id);

        Assert.Collection(
            result,
            item => Assert.Equal(new DateOnly(2027, 6, 1), item.RequestedDate),
            item => Assert.Equal(new DateOnly(2027, 6, 1), item.RequestedDate),
            item => Assert.Equal(new DateOnly(2027, 7, 2), item.RequestedDate));
    }

    [Fact]
    public async Task GetBookingRequests_OnlyLiveRequests_AreReturned()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599200015", ApplicationRoles.HallOwner);
        var requester = await CreateUserAsync(
            "requester@example.com",
            "+970599200016",
            ApplicationRoles.RegisteredUser,
            fullName: "Pending Only");
        var hall = AddHall(owner.Id, "Grand Hall");
        AddBooking(hall, requester.Id, new DateOnly(2027, 6, 1), new TimeOnly(10, 0), BookingStatus.Pending);
        AddBooking(hall, requester.Id, new DateOnly(2027, 6, 1), new TimeOnly(11, 0), BookingStatus.Accepted);
        AddBooking(hall, requester.Id, new DateOnly(2027, 6, 5), new TimeOnly(10, 0), BookingStatus.Rejected);
        AddBooking(hall, requester.Id, new DateOnly(2027, 6, 5), new TimeOnly(11, 0), BookingStatus.Cancelled);

        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetBookingRequestsAsync(hall.Id);

        // WESAL-TASK-8 (Edit 8): an approved request stays listed, because the owner still
        // owes it a deposit confirmation. Only rejected and cancelled requests drop out.
        Assert.Equal(2, result.Count);
        Assert.Contains(result, item => item.Status == BookingStatus.Pending);
        Assert.Contains(result, item => item.Status == BookingStatus.Accepted);
    }

    [Fact]
    public async Task GetBookingRequests_OtherHallsBookingRequests_AreExcluded()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599200017", ApplicationRoles.HallOwner);
        var requester = await CreateUserAsync(
            "requester@example.com",
            "+970599200018",
            ApplicationRoles.RegisteredUser,
            fullName: "Scoped Requester");
        var myHall = AddHall(owner.Id, "My Hall");
        var otherHall = AddHall(owner.Id, "Other Owned Hall");
        AddBooking(otherHall, requester.Id, new DateOnly(2027, 6, 1), new TimeOnly(10, 0));

        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetBookingRequestsAsync(myHall.Id);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetBookingRequests_DoesNotMutateBookings()
    {
        var owner = await CreateUserAsync("owner@example.com", "+970599200019", ApplicationRoles.HallOwner);
        var requester = await CreateUserAsync(
            "requester@example.com",
            "+970599200020",
            ApplicationRoles.RegisteredUser,
            fullName: "Immutable Requester");
        var hall = AddHall(owner.Id, "Grand Hall");
        var booking = AddBooking(hall, requester.Id, new DateOnly(2027, 6, 1), new TimeOnly(10, 0));

        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        await service.GetBookingRequestsAsync(hall.Id);

        var persisted = _context.Bookings
            .AsNoTracking()
            .Include(item => item.Slots)
            .Single(item => item.Id == booking.Id);

        Assert.Equal(BookingStatus.Pending, persisted.Status);
        Assert.Equal(new TimeOnly(10, 0), Assert.Single(persisted.Slots).StartTime);
        Assert.Equal(hall.Id, persisted.HallId);
    }

    [Fact]
    public async Task GetBookingRequests_ResolvesOwnerAndHallOnlyFromServerState()
    {
        // The read API must never accept a client-supplied owner identity, requester
        // identity, or requester name: all three are resolved from the persisted user
        // profile / hall record on the server.
        var method = typeof(IOwnerBookingRequestsService).GetMethod(nameof(IOwnerBookingRequestsService.GetBookingRequestsAsync));
        Assert.NotNull(method);

        var parameters = method!.GetParameters();
        Assert.Equal(2, parameters.Length);
        Assert.Equal(typeof(Guid), parameters[0].ParameterType);
        Assert.Equal(typeof(CancellationToken), parameters[1].ParameterType);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }

    private OwnerBookingRequestsService CreateService(FakeCurrentUser currentUser)
        => new(
            _userManager,
            currentUser,
            new OwnerDashboardRepository(_context));

    private async Task<ApplicationUser> CreateUserAsync(
        string email,
        string phone,
        string role,
        string fullName = "Regular User")
    {
        var user = new ApplicationUser { FullName = fullName, Email = email, UserName = email, PhoneNumber = phone };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded) throw new Exception(string.Join(",", result.Errors.Select(e => e.Description)));
        await _userManager.AddToRoleAsync(user, role);
        return user;
    }

    private Hall AddHall(string ownerId, string name, bool isDeleted = false)
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
            PaymentStatus = HallPaymentStatus.Paid,
            IsDeleted = isDeleted
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
        BookingStatus status = BookingStatus.Pending)
    {
        var booking = new Booking
        {
            HallId = hall.Id,
            RequesterUserId = requesterUserId,
            Date = date,
            Slots =
            [
                new BookingSlot
                {
                    StartTime = slotStart,
                    EndTime = slotStart.AddHours(1)
                }
            ],
            Status = status
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
            Roles = userId is null ? [] : [ApplicationRoles.HallOwner];
        }

        public string? UserId { get; }

        public string? UserName => "test";

        public string? Email => "test@example.com";

        public bool IsAuthenticated { get; }

        public IReadOnlyList<string> Roles { get; }
    }
}