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

public class OwnerHallSubscriptionServiceShould : IDisposable
{
    private static readonly DateTimeOffset FixedNow = new(2026, 9, 12, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = DateOnly.FromDateTime(FixedNow.UtcDateTime);

    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public OwnerHallSubscriptionServiceShould()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(o => o
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));
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

    private Hall AddHall(
        string ownerId,
        string name = "Grand Hall",
        HallStatus status = HallStatus.Approved,
        DateOnly? cycleEnd = null,
        bool adminLocked = false,
        bool deleted = false)
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
            SubscriptionCycleEnd = cycleEnd,
            IsAdminLocked = adminLocked,
            IsDeleted = deleted
        };
        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    private HallSubscriptionService CreateService(FakeCurrentUser currentUser, IDateTime? dateTime = null)
        => new(
            _userManager,
            currentUser,
            new OwnerDashboardRepository(_context),
            dateTime ?? new FakeDateTime());

    [Fact]
    public async Task GetSubscription_ActivePaidHall_ReturnsActiveWithBillingDate()
    {
        var owner = await CreateOwnerAsync("owner1@example.com", "+970599000001");
        var hall = AddHall(owner.Id, cycleEnd: Today.AddDays(20));
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetHallSubscriptionAsync(hall.Id);

        Assert.Equal(hall.Id, result.HallId);
        Assert.Equal(hall.Name, result.HallName);
        Assert.Equal(HallSubscriptionStatus.Active, result.Status);
        Assert.Equal(Today.AddDays(20), result.NextBillingDate);
    }

    [Fact]
    public async Task GetSubscription_ActiveHall_CycleEndsToday_StillActive()
    {
        var owner = await CreateOwnerAsync("owner2@example.com", "+970599000002");
        var hall = AddHall(owner.Id, cycleEnd: Today);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetHallSubscriptionAsync(hall.Id);

        Assert.Equal(HallSubscriptionStatus.Active, result.Status);
        Assert.Equal(Today, result.NextBillingDate);
    }

    [Fact]
    public async Task GetSubscription_ApprovedButUnpaid_ReturnsPaymentPendingWithNoBillingDate()
    {
        var owner = await CreateOwnerAsync("owner3@example.com", "+970599000003");
        var hall = AddHall(owner.Id, cycleEnd: null);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetHallSubscriptionAsync(hall.Id);

        Assert.Equal(HallSubscriptionStatus.PaymentPending, result.Status);
        Assert.Null(result.NextBillingDate);
    }

    [Fact]
    public async Task GetSubscription_PendingReview_ReturnsPaymentPendingWithNoBillingDate()
    {
        var owner = await CreateOwnerAsync("owner4@example.com", "+970599000004");
        var hall = AddHall(owner.Id, status: HallStatus.PendingReview, cycleEnd: Today.AddDays(10));
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetHallSubscriptionAsync(hall.Id);

        Assert.Equal(HallSubscriptionStatus.PaymentPending, result.Status);
        Assert.Null(result.NextBillingDate);
    }

    [Fact]
    public async Task GetSubscription_RejectedHall_ReturnsPaymentPendingWithNoBillingDate()
    {
        var owner = await CreateOwnerAsync("owner5@example.com", "+970599000005");
        var hall = AddHall(owner.Id, status: HallStatus.Rejected, cycleEnd: Today.AddDays(10));
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetHallSubscriptionAsync(hall.Id);

        Assert.Equal(HallSubscriptionStatus.PaymentPending, result.Status);
        Assert.Null(result.NextBillingDate);
    }

    [Fact]
    public async Task GetSubscription_PaymentPending_IsNotReportedAsActive()
    {
        var owner = await CreateOwnerAsync("owner6@example.com", "+970599000006");
        var hall = AddHall(owner.Id, cycleEnd: null);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetHallSubscriptionAsync(hall.Id);

        Assert.NotEqual(HallSubscriptionStatus.Active, result.Status);
        Assert.Equal(HallSubscriptionStatus.PaymentPending, result.Status);
    }

    [Fact]
    public async Task GetSubscription_ExpiredHall_ReturnsExpiredWithLapsedCycleEnd()
    {
        var owner = await CreateOwnerAsync("owner7@example.com", "+970599000007");
        var hall = AddHall(owner.Id, cycleEnd: Today.AddDays(-3));
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetHallSubscriptionAsync(hall.Id);

        Assert.Equal(HallSubscriptionStatus.Expired, result.Status);
        Assert.Equal(Today.AddDays(-3), result.NextBillingDate);
    }

    [Fact]
    public async Task GetSubscription_ExpiredHall_IsNotReportedAsActive()
    {
        var owner = await CreateOwnerAsync("owner8@example.com", "+970599000008");
        var hall = AddHall(owner.Id, cycleEnd: Today.AddDays(-1));
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetHallSubscriptionAsync(hall.Id);

        Assert.Equal(HallSubscriptionStatus.Expired, result.Status);
        Assert.NotEqual(HallSubscriptionStatus.Active, result.Status);
    }

    [Fact]
    public async Task GetSubscription_AdminLockedPaidHall_ReturnsLocked_WithBillingDate()
    {
        var owner = await CreateOwnerAsync("owner9@example.com", "+970599000009");
        var hall = AddHall(owner.Id, cycleEnd: Today.AddDays(15), adminLocked: true);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetHallSubscriptionAsync(hall.Id);

        Assert.Equal(HallSubscriptionStatus.Locked, result.Status);
        Assert.Equal(Today.AddDays(15), result.NextBillingDate);
    }

    [Fact]
    public async Task GetSubscription_AdminLockedUnpaidHall_ReturnsLockedWithNoBillingDate()
    {
        var owner = await CreateOwnerAsync("owner10@example.com", "+970599000010");
        var hall = AddHall(owner.Id, cycleEnd: null, adminLocked: true);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetHallSubscriptionAsync(hall.Id);

        Assert.Equal(HallSubscriptionStatus.Locked, result.Status);
        Assert.Null(result.NextBillingDate);
    }

    [Fact]
    public async Task GetSubscription_AdminLockedExpiredHall_ReturnsLocked_NotExpired()
    {
        var owner = await CreateOwnerAsync("owner11@example.com", "+970599000011");
        var hall = AddHall(owner.Id, cycleEnd: Today.AddDays(-10), adminLocked: true);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetHallSubscriptionAsync(hall.Id);

        Assert.Equal(HallSubscriptionStatus.Locked, result.Status);
        Assert.NotEqual(HallSubscriptionStatus.Expired, result.Status);
    }

    [Fact]
    public async Task GetSubscription_LockedHall_IsNotReportedAsActive()
    {
        var owner = await CreateOwnerAsync("owner12@example.com", "+970599000012");
        var hall = AddHall(owner.Id, cycleEnd: Today.AddDays(5), adminLocked: true);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetHallSubscriptionAsync(hall.Id);

        Assert.Equal(HallSubscriptionStatus.Locked, result.Status);
        Assert.NotEqual(HallSubscriptionStatus.Active, result.Status);
    }

    [Fact]
    public async Task GetSubscription_AnotherOwnersHall_ThrowsNotFound()
    {
        var ownerA = await CreateOwnerAsync("ownera@example.com", "+970599000013");
        var ownerB = await CreateOwnerAsync("ownerb@example.com", "+970599000014");
        var hall = AddHall(ownerA.Id, cycleEnd: Today.AddDays(10));
        var service = CreateService(new FakeCurrentUser(ownerB.Id, true));

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetHallSubscriptionAsync(hall.Id));
    }

    [Fact]
    public async Task GetSubscription_NonexistentHall_ThrowsNotFound()
    {
        var owner = await CreateOwnerAsync("ownerc@example.com", "+970599000015");
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetHallSubscriptionAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task GetSubscription_DeletedHall_ThrowsNotFound()
    {
        var owner = await CreateOwnerAsync("ownerd@example.com", "+970599000016");
        var hall = AddHall(owner.Id, cycleEnd: Today.AddDays(10), deleted: true);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetHallSubscriptionAsync(hall.Id));
    }

    [Fact]
    public async Task GetSubscription_Unauthenticated_ThrowsUnauthorized()
    {
        var owner = await CreateOwnerAsync("ownere@example.com", "+970599000017");
        var hall = AddHall(owner.Id, cycleEnd: Today.AddDays(10));
        var service = CreateService(new FakeCurrentUser(null, false));

        await Assert.ThrowsAsync<UnauthorizedException>(() => service.GetHallSubscriptionAsync(hall.Id));
    }

    [Fact]
    public async Task GetSubscription_DeletedOwnerAccount_ThrowsNotFound()
    {
        var owner = await CreateOwnerAsync("ownerf@example.com", "+970599000018");
        var hall = AddHall(owner.Id, cycleEnd: Today.AddDays(10));
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        _context.Users.Remove(await _context.Users.SingleAsync(u => u.Id == owner.Id));
        await _context.SaveChangesAsync();

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetHallSubscriptionAsync(hall.Id));
    }

    [Fact]
    public async Task GetSubscription_MultipleHalls_SameOwner_IndependentStatuses()
    {
        var owner = await CreateOwnerAsync("ownerg@example.com", "+970599000019");
        var hallA = AddHall(owner.Id, "Hall A", cycleEnd: Today.AddDays(25));
        var hallB = AddHall(owner.Id, "Hall B", cycleEnd: null);
        var hallC = AddHall(owner.Id, "Hall C", cycleEnd: Today.AddDays(-5));
        var hallD = AddHall(owner.Id, "Hall D", cycleEnd: Today.AddDays(3), adminLocked: true);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var a = await service.GetHallSubscriptionAsync(hallA.Id);
        var b = await service.GetHallSubscriptionAsync(hallB.Id);
        var c = await service.GetHallSubscriptionAsync(hallC.Id);
        var d = await service.GetHallSubscriptionAsync(hallD.Id);

        Assert.Equal(hallA.Id, a.HallId);
        Assert.Equal(HallSubscriptionStatus.Active, a.Status);
        Assert.Equal(Today.AddDays(25), a.NextBillingDate);

        Assert.Equal(hallB.Id, b.HallId);
        Assert.Equal(HallSubscriptionStatus.PaymentPending, b.Status);
        Assert.Null(b.NextBillingDate);

        Assert.Equal(hallC.Id, c.HallId);
        Assert.Equal(HallSubscriptionStatus.Expired, c.Status);

        Assert.Equal(hallD.Id, d.HallId);
        Assert.Equal(HallSubscriptionStatus.Locked, d.Status);
    }

    [Fact]
    public async Task GetSubscription_TwoActiveHallsOnDifferentDates_HaveIndependentBillingDates()
    {
        var owner = await CreateOwnerAsync("ownerh@example.com", "+970599000020");
        var hallA = AddHall(owner.Id, "Hall A", cycleEnd: new DateOnly(2026, 10, 1));
        var hallB = AddHall(owner.Id, "Hall B", cycleEnd: new DateOnly(2026, 11, 1));
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var a = await service.GetHallSubscriptionAsync(hallA.Id);
        var b = await service.GetHallSubscriptionAsync(hallB.Id);

        Assert.Equal(HallSubscriptionStatus.Active, a.Status);
        Assert.Equal(HallSubscriptionStatus.Active, b.Status);
        Assert.NotEqual(a.NextBillingDate, b.NextBillingDate);
        Assert.Equal(new DateOnly(2026, 10, 1), a.NextBillingDate);
        Assert.Equal(new DateOnly(2026, 11, 1), b.NextBillingDate);
    }

    [Fact]
    public async Task GetSubscription_IsReadOnly_DoesNotMutatePersistedState()
    {
        var owner = await CreateOwnerAsync("owneri@example.com", "+970599000021");
        var hall = AddHall(owner.Id, cycleEnd: Today.AddDays(30));
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        await service.GetHallSubscriptionAsync(hall.Id);

        var persisted = await _context.Halls.AsNoTracking().SingleAsync(h => h.Id == hall.Id);
        Assert.Equal(Today.AddDays(30), persisted.SubscriptionCycleEnd);
        Assert.False(persisted.IsAdminLocked);
        Assert.Equal(HallStatus.Approved, persisted.Status);
        Assert.False(persisted.IsDeleted);
    }

    [Fact]
    public async Task GetSubscription_RefreshesCurrentServerState_OnEveryRequest()
    {
        var owner = await CreateOwnerAsync("ownerj@example.com", "+970599000022");
        var hall = AddHall(owner.Id, cycleEnd: null);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var before = await service.GetHallSubscriptionAsync(hall.Id);
        Assert.Equal(HallSubscriptionStatus.PaymentPending, before.Status);

        // Admin confirms payment in another session: the cycle extends 30 days.
        var persisted = await _context.Halls.SingleAsync(h => h.Id == hall.Id);
        persisted.SubscriptionCycleEnd = Today.AddDays(30);
        await _context.SaveChangesAsync();

        var after = await service.GetHallSubscriptionAsync(hall.Id);
        Assert.Equal(HallSubscriptionStatus.Active, after.Status);
        Assert.Equal(Today.AddDays(30), after.NextBillingDate);
    }

    [Fact]
    public async Task GetSubscription_ClientProvidedStatusCannotOverridePersistedState()
    {
        // The endpoint takes no body and the service has no status/billing input:
        // the result is derived solely from persisted state, so a client could never
        // pass "Active" (or any billing date) to change the outcome. Prove it by
        // reading a persisted PaymentPending hall through the same service and
        // asserting only the true state is returned.
        var owner = await CreateOwnerAsync("ownerk@example.com", "+970599000023");
        var hall = AddHall(owner.Id, cycleEnd: null);
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        var result = await service.GetHallSubscriptionAsync(hall.Id);

        Assert.Equal(HallSubscriptionStatus.PaymentPending, result.Status);
        Assert.Null(result.NextBillingDate);
    }

    [Fact]
    public async Task GetSubscription_ResponseContract_IsMinimal_NoProviderFields()
    {
        var owner = await CreateOwnerAsync("ownerl@example.com", "+970599000024");
        var hall = AddHall(owner.Id, cycleEnd: Today.AddDays(20));
        var service = CreateService(new FakeCurrentUser(owner.Id, true));

        await service.GetHallSubscriptionAsync(hall.Id);

        var props = typeof(OwnerHallSubscriptionDto)
            .GetProperties()
            .Select(p => p.Name)
            .OrderBy(n => n)
            .ToArray();
        Assert.Equal(new[] { "HallId", "HallName", "NextBillingDate", "Status" }, props);
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
        public IReadOnlyList<string> Roles => ["HallOwner"];
    }

    private sealed class FakeDateTime : IDateTime
    {
        public DateTimeOffset Now => FixedNow;
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }
}