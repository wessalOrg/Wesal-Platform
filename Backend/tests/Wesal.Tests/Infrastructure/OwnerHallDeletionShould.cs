using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.OwnerDashboard;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

public class OwnerHallDeletionShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public OwnerHallDeletionShould()
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

    private async Task<ApplicationUser> CreateOwnerAsync(string email, string phone)
    {
        var user = new ApplicationUser { FullName = "Hall Owner", Email = email, UserName = email, PhoneNumber = phone };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded) throw new Exception(string.Join(",", result.Errors.Select(e => e.Description)));
        await _userManager.AddToRoleAsync(user, ApplicationRoles.HallOwner);
        return user;
    }

    private Hall AddHall(string ownerId, string name, HallStatus status = HallStatus.Approved, bool isDeleted = false)
    {
        var hall = new Hall
        {
            Name = name,
            Address = "Al-Rashid Street, Gaza",
            Region = HallRegion.Gaza,
            Capacity = 200,
            Price = 1500,
            ShowPrice = true,
            ContactPhone = "+970599111111",
            Description = "Spacious hall",
            OwnerId = ownerId,
            Status = status,
            PaymentStatus = HallPaymentStatus.Paid,
            IsDeleted = isDeleted
        };
        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    private OwnerHallService CreateService(FakeCurrentUser currentUser)
        => new(
            _userManager,
            currentUser,
            new OwnerDashboardRepository(_context),
            new UnitOfWork(_context));

    [Fact]
    public async Task DeleteOwnedHall_SetsIsDeletedAndRemainsInDatabase()
    {
        var owner = await CreateOwnerAsync("owner1@example.com", "+970599000001");
        var hall = AddHall(owner.Id, "Grand Hall");
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        await service.DeleteOwnedHallAsync(hall.Id);

        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.NotNull(reloaded);
        Assert.True(reloaded!.IsDeleted);
    }

    [Fact]
    public async Task DeleteOwnedHall_Unauthenticated_ThrowsUnauthorized()
    {
        var owner = await CreateOwnerAsync("owner2@example.com", "+970599000002");
        var hall = AddHall(owner.Id, "Grand Hall");
        var service = CreateService(new FakeCurrentUser(null, false));

        await Assert.ThrowsAsync<UnauthorizedException>(() => service.DeleteOwnedHallAsync(hall.Id));

        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.False(reloaded!.IsDeleted);
    }

    [Fact]
    public async Task DeleteOwnedHall_AnotherOwner_ThrowsNotFound()
    {
        var ownerA = await CreateOwnerAsync("ownera@example.com", "+970599000003");
        var ownerB = await CreateOwnerAsync("ownerb@example.com", "+970599000004");
        var hall = AddHall(ownerA.Id, "Grand Hall");
        var service = CreateService(new FakeCurrentUser(ownerB.Id, true));

        await Assert.ThrowsAsync<NotFoundException>(() => service.DeleteOwnedHallAsync(hall.Id));

        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.False(reloaded!.IsDeleted);
    }

    [Fact]
    public async Task DeleteOwnedHall_NonExistent_ThrowsNotFound()
    {
        var owner = await CreateOwnerAsync("owner3@example.com", "+970599000005");
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        await Assert.ThrowsAsync<NotFoundException>(() => service.DeleteOwnedHallAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task DeleteOwnedHall_AlreadyDeleted_ThrowsNotFound()
    {
        var owner = await CreateOwnerAsync("owner4@example.com", "+970599000006");
        var hall = AddHall(owner.Id, "Grand Hall", isDeleted: true);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        await Assert.ThrowsAsync<NotFoundException>(() => service.DeleteOwnedHallAsync(hall.Id));
    }

    [Fact]
    public async Task DeleteOwnedHall_PreservesBookingHistory()
    {
        var owner = await CreateOwnerAsync("owner5@example.com", "+970599000007");
        var hall = AddHall(owner.Id, "Grand Hall");
        var booking = new Booking
        {
            HallId = hall.Id,
            RequesterUserId = "requester-1",
            Date = new DateOnly(2026, 9, 20),
            Period = BookingPeriodType.FirstPeriod,
            Status = BookingStatus.Pending
        };
        _context.Bookings.Add(booking);
        await _context.SaveChangesAsync();

        var service = CreateService(new FakeCurrentUser(owner.Id, true));
        await service.DeleteOwnedHallAsync(hall.Id);

        var reloadedBooking = await _context.Bookings.FindAsync(booking.Id);
        Assert.NotNull(reloadedBooking);
        Assert.Equal(BookingStatus.Pending, reloadedBooking!.Status);

        var reloadedHall = await _context.Halls.FindAsync(hall.Id);
        Assert.True(reloadedHall!.IsDeleted);
    }

    [Fact]
    public async Task DeleteOwnedHall_PreservesMessageHistory()
    {
        var owner = await CreateOwnerAsync("owner6@example.com", "+970599000008");
        var hall = AddHall(owner.Id, "Grand Hall");
        var conversation = new Conversation { HallId = hall.Id, SenderUserId = "requester-1", HallOwnerId = owner.Id };
        _context.Conversations.Add(conversation);
        await _context.SaveChangesAsync();
        var message = new Message { ConversationId = conversation.Id, SenderUserId = "requester-1", Content = "Hello" };
        _context.Messages.Add(message);
        await _context.SaveChangesAsync();

        var service = CreateService(new FakeCurrentUser(owner.Id, true));
        await service.DeleteOwnedHallAsync(hall.Id);

        Assert.NotNull(await _context.Conversations.FindAsync(conversation.Id));
        Assert.NotNull(await _context.Messages.FindAsync(message.Id));
    }

    [Fact]
    public async Task DeleteOwnedHall_OwnedHallsListExcludesDeleted()
    {
        var owner = await CreateOwnerAsync("owner7@example.com", "+970599000009");
        var hallA = AddHall(owner.Id, "Hall A");
        var hallB = AddHall(owner.Id, "Hall B");
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        await service.DeleteOwnedHallAsync(hallA.Id);

        var remaining = await _context.Halls.AsNoTracking()
            .Where(h => h.OwnerId == owner.Id && !h.IsDeleted)
            .ToListAsync();
        Assert.Single(remaining);
        Assert.Equal(hallB.Id, remaining[0].Id);
    }

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        public FakeCurrentUser(string? userId, bool authenticated)
        {
            UserId = userId;
            IsAuthenticated = authenticated;
        }
        public string? UserId { get; }
        public string? UserName => "test";
        public string? Email => "test@example.com";
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles => [ApplicationRoles.HallOwner];
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }
}
