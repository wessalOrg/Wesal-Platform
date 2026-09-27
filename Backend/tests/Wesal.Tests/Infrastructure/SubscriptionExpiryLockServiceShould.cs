using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.Admin;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

public class SubscriptionExpiryLockServiceShould : IDisposable
{
    private static readonly DateTimeOffset FixedNow = new(2026, 8, 15, 10, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = DateOnly.FromDateTime(FixedNow.UtcDateTime);

    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;

    public SubscriptionExpiryLockServiceShould()
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
    }

    private Hall AddHall(
        string name,
        HallStatus status = HallStatus.Approved,
        HallPaymentStatus payment = HallPaymentStatus.Paid,
        DateOnly? cycleEnd = null,
        bool systemLocked = false,
        bool isAdminLocked = false,
        string? ownerId = null)
    {
        var hall = new Hall
        {
            Name = name,
            Region = HallRegion.Gaza,
            OwnerId = ownerId ?? "owner-1",
            Status = status,
            PaymentStatus = payment,
            SubscriptionCycleEnd = cycleEnd,
            SubscriptionCycleStart = cycleEnd?.AddDays(-30),
            SystemLocked = systemLocked,
            IsAdminLocked = isAdminLocked,
            LockedByAdminUserId = isAdminLocked ? "admin-1" : null,
            LockedAt = isAdminLocked ? FixedNow : null
        };
        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    private SubscriptionExpiryLockService CreateService()
        => new(
            new AdminDashboardRepository(_context),
            new HallRepository(_context),
            new UnitOfWork(_context),
            new ConversationRepository(_context),
            new MessageRepository(_context),
            new FakeDateTime(),
            NullLogger<SubscriptionExpiryLockService>.Instance,
            new Wesal.Infrastructure.Notifications.NotificationService(_provider.GetRequiredService<UserManager<ApplicationUser>>()));

    // --- US-ADMIN-09: automatic expiry lock ---

    [Fact]
    public async Task ExpiredPaidCycle_LocksHallAndNotifiesOwner()
    {
        var hall = AddHall("Grand Hall", cycleEnd: Today.AddDays(-1));

        var locked = await CreateService().LockExpiredCyclesAsync();

        Assert.Equal(1, locked);

        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.True(reloaded!.SystemLocked);
        Assert.False(reloaded.IsAdminLocked);

        var message = await _context.Messages
            .Include(m => m.Conversation)
            .FirstOrDefaultAsync(m => m.SenderUserId == SubscriptionExpiryLockService.SystemSenderUserId);
        Assert.NotNull(message);
        Assert.Equal(hall.Id, message!.Conversation.HallId);
        Assert.Equal("owner-1", message.Conversation.HallOwnerId);
        // WESAL-TASK-13 (Edit 13): the notice body now comes from the catalog in the owner's
        // own language, and "owner-1" here is not a real user row, so the service correctly
        // falls back to the platform default. Assert the durable facts (hall identity) and
        // leave the language choice to LockNoticeBody_FollowsTheOwnersChosenLanguage.
        Assert.Contains(hall.Name, message.Content);
    }

    [Fact]
    public async Task NotExpiredCycle_IsNotLocked()
    {
        var hall = AddHall("Grand Hall", cycleEnd: Today.AddDays(10));

        var locked = await CreateService().LockExpiredCyclesAsync();

        Assert.Equal(0, locked);
        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.False(reloaded!.SystemLocked);
    }

    [Fact]
    public async Task CycleEndingToday_IsNotLocked()
    {
        var hall = AddHall("Grand Hall", cycleEnd: Today);

        var locked = await CreateService().LockExpiredCyclesAsync();

        Assert.Equal(0, locked);
        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.False(reloaded!.SystemLocked);
    }

    [Fact]
    public async Task AlreadySystemLocked_IsSkipped()
    {
        var hall = AddHall("Grand Hall", cycleEnd: Today.AddDays(-1), systemLocked: true);

        var locked = await CreateService().LockExpiredCyclesAsync();

        Assert.Equal(0, locked);
        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.True(reloaded!.SystemLocked);
    }

    [Fact]
    public async Task UnpaidHall_IsNotSystemLocked()
    {
        var hall = AddHall("Grand Hall", payment: HallPaymentStatus.Unpaid, cycleEnd: Today.AddDays(-1));

        var locked = await CreateService().LockExpiredCyclesAsync();

        Assert.Equal(0, locked);
        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.False(reloaded!.SystemLocked);
        Assert.Equal(HallPaymentStatus.Unpaid, reloaded!.PaymentStatus);
    }

    [Fact]
    public async Task PendingApprovalHall_IsNotSystemLocked()
    {
        var hall = AddHall("Grand Hall", status: HallStatus.PendingReview, cycleEnd: Today.AddDays(-1));

        var locked = await CreateService().LockExpiredCyclesAsync();

        Assert.Equal(0, locked);
        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.False(reloaded!.SystemLocked);
    }

    [Fact]
    public async Task LockedHall_AdminLock_IsNotTouchedBySystemLock()
    {
        var hall = AddHall("Grand Hall", cycleEnd: Today.AddDays(-1), isAdminLocked: true);

        var locked = await CreateService().LockExpiredCyclesAsync();

        Assert.Equal(1, locked);
        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.True(reloaded!.IsAdminLocked);
        Assert.NotNull(reloaded.LockedByAdminUserId);
        Assert.NotNull(reloaded.LockedAt);
    }

    [Fact]
    public async Task ExpiredLock_NotifiesOnlyOnce()
    {
        var hall = AddHall("Grand Hall", cycleEnd: Today.AddDays(-1));

        var service = CreateService();
        var first = await service.LockExpiredCyclesAsync();
        var second = await service.LockExpiredCyclesAsync();

        Assert.Equal(1, first);
        Assert.Equal(0, second);
        Assert.Equal(1, await _context.Messages.CountAsync(m => m.SenderUserId == SubscriptionExpiryLockService.SystemSenderUserId));
    }

    [Theory]
    [InlineData(Language.English)]
    [InlineData(Language.Arabic)]
    public async Task LockNoticeBody_FollowsTheOwnersChosenLanguage(Language language)
    {
        // WESAL-TASK-13 (Edit 13): the automatic-lock notice used to be an English-only
        // string, so an Arabic-speaking owner was told their hall had been restricted in a
        // language they had not chosen. It now renders in the OWNER's stored language.
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001", language);
        var hall = AddHall("Grand Hall", cycleEnd: Today.AddDays(-1), ownerId: owner.Id);

        Assert.Equal(1, await CreateService().LockExpiredCyclesAsync());

        var message = await _context.Messages
            .FirstOrDefaultAsync(m => m.SenderUserId == SubscriptionExpiryLockService.SystemSenderUserId);

        Assert.NotNull(message);
        Assert.Contains("Grand Hall", message!.Content, StringComparison.Ordinal);

        if (language == Language.English)
        {
            Assert.Contains("renew", message.Content, StringComparison.OrdinalIgnoreCase);
        }
        else
        {
            Assert.Contains("تجديد", message.Content, StringComparison.Ordinal);
        }
    }

    private async Task<ApplicationUser> CreateOwnerAsync(string email, string phone, Language language)
    {
        var userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = new ApplicationUser
        {
            FullName = "Hall Owner",
            Email = email,
            UserName = email,
            PhoneNumber = phone,
            PreferredLanguage = language
        };

        await userManager.CreateAsync(user, "Password123!");
        return user;
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }

    private sealed class FakeDateTime : IDateTime
    {
        public DateTimeOffset Now => FixedNow;
    }
}