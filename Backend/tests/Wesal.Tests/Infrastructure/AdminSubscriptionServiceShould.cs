using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Admin;
using Wesal.Infrastructure.AiAssistant;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

public class AdminSubscriptionServiceShould : IDisposable
{
    private static readonly DateTimeOffset FixedNow = new(2026, 8, 15, 10, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = DateOnly.FromDateTime(FixedNow.UtcDateTime);

    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;

    public AdminSubscriptionServiceShould()
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

    private void AddOwner(string id, string fullName, string phone, string email)
    {
        _context.Users.Add(new ApplicationUser
        {
            Id = id,
            FullName = fullName,
            PhoneNumber = phone,
            Email = email,
            UserName = email,
            NormalizedEmail = email.ToUpperInvariant(),
            NormalizedUserName = email.ToUpperInvariant()
        });
        _context.SaveChanges();
    }

    private Hall AddHall(
          string name,
          string ownerId,
          HallStatus status = HallStatus.Approved,
          HallPaymentStatus payment = HallPaymentStatus.Paid,
          bool systemLocked = false,
          bool isAdminLocked = false,
          DateOnly? cycleEnd = null,
          DateOnly? cycleStart = null,
          bool isDeleted = false)
      {
          var hall = new Hall
          {
              Name = name,
              Region = HallRegion.Gaza,
              OwnerId = ownerId,
              Status = status,
              PaymentStatus = payment,
              SystemLocked = systemLocked,
              IsAdminLocked = isAdminLocked,
              IsDeleted = isDeleted,
              SubscriptionCycleEnd = cycleEnd,
              // Default the start to 30 days before the end unless a test overrides it,
              // which lets a test model a half-set cycle explicitly.
              SubscriptionCycleStart = cycleStart ?? cycleEnd?.AddDays(-30),
              LockedAt = isAdminLocked ? FixedNow : null,
              LockedByAdminUserId = isAdminLocked ? "admin-1" : null
          };
          _context.Halls.Add(hall);
          _context.SaveChanges();
          return hall;
      }

    private AdminSubscriptionService CreateService()
        => new(
            new AdminDashboardRepository(_context),
            new HallRepository(_context),
            Options.Create(new SubscriptionPaymentOptions
            {
                SubscriptionPriceIls = 120m,
                SubscriptionCycleDays = 30,
                AdminWhatsAppContact = SubscriptionPaymentOptions.DefaultAdminWhatsApp
            }),
            new UnitOfWork(_context),
            new ConversationRepository(_context),
            new MessageRepository(_context),
            new FakeConversationNotifier(),
            new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin),
            new FakeDateTime(),
            NullLogger<AdminSubscriptionService>.Instance);

    private sealed class FakeConversationNotifier : IConversationNotifier
    {
        public Task NotifyMessageSentAsync(MessageSentEvent message, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    // --- US-ADMIN-11: subscription overview ---

    [Fact]
    public async Task Overview_GroupsHallsByOwner_AndExposesLiveState()
    {
        AddOwner("owner-1", "Alaa Owner", "+970111", "alaa@example.com");
        AddOwner("owner-2", "Lilian Owner", "+970222", "lilian@example.com");
        var h1 = AddHall("Hall A", "owner-1", cycleEnd: Today.AddDays(5));
        var h2 = AddHall("Hall B", "owner-1", payment: HallPaymentStatus.Unpaid, isAdminLocked: true);
        AddHall("Hall C", "owner-2", systemLocked: true);

        var result = await CreateService().GetSubscriptionOverviewAsync(new AdminSubscriptionOverviewQueryDto());

        Assert.Equal(2, result.Count);

        var owner1 = result.Single(g => g.OwnerId == "owner-1");
        Assert.Equal("Alaa Owner", owner1.OwnerFullName);
        Assert.Equal(2, owner1.Halls.Count);

        var h1Dto = owner1.Halls.Single(h => h.HallId == h1.Id);
        Assert.Equal(HallStatus.Approved, h1Dto.ApprovalStatus);
        Assert.Equal(HallPaymentStatus.Paid, h1Dto.PaymentStatus);
        Assert.Equal(Today.AddDays(5), h1Dto.NextBillingDate);
        Assert.Equal(5, h1Dto.DaysRemaining);

        var h2Dto = owner1.Halls.Single(h => h.HallId == h2.Id);
        Assert.Equal(HallPaymentStatus.Unpaid, h2Dto.PaymentStatus);
        Assert.True(h2Dto.AdminLocked);
        Assert.Equal("admin-1", h2Dto.LockedByAdminUserId);
        Assert.NotNull(h2Dto.LockedAt);
    }

    [Fact]
    public async Task Overview_FiltersByPaymentStatus()
    {
        AddOwner("owner-1", "Alaa Owner", "+970111", "alaa@example.com");
        AddHall("Paid Hall", "owner-1", payment: HallPaymentStatus.Paid);
        AddHall("Unpaid Hall", "owner-1", payment: HallPaymentStatus.Unpaid);

        var result = await CreateService().GetSubscriptionOverviewAsync(
            new AdminSubscriptionOverviewQueryDto { PaymentStatus = HallPaymentStatus.Unpaid });

        var halls = result.SelectMany(g => g.Halls);
        Assert.Single(halls);
        Assert.Equal("Unpaid Hall", halls.Single().Name);
    }

    [Fact]
    public async Task Overview_FiltersByLocked()
    {
        AddOwner("owner-1", "Alaa Owner", "+970111", "alaa@example.com");
        AddHall("Admin Locked", "owner-1", isAdminLocked: true);
        AddHall("System Locked", "owner-1", systemLocked: true);
        AddHall("Open Hall", "owner-1");

        var result = await CreateService().GetSubscriptionOverviewAsync(
            new AdminSubscriptionOverviewQueryDto { Locked = true });

        var halls = result.SelectMany(g => g.Halls);
        Assert.Equal(2, halls.Count());
        Assert.Contains(halls, h => h.Name == "Admin Locked");
        Assert.Contains(halls, h => h.Name == "System Locked");
    }

    [Fact]
    public async Task Overview_FiltersByApprovalStatus()
    {
        AddOwner("owner-1", "Alaa Owner", "+970111", "alaa@example.com");
        AddHall("Approved Hall", "owner-1", status: HallStatus.Approved);
        AddHall("Pending Hall", "owner-1", status: HallStatus.PendingReview);

        var result = await CreateService().GetSubscriptionOverviewAsync(
            new AdminSubscriptionOverviewQueryDto { ApprovalStatus = HallStatus.PendingReview });

        var halls = result.SelectMany(g => g.Halls);
        Assert.Single(halls);
        Assert.Equal("Pending Hall", halls.Single().Name);
    }

    [Fact]
    public async Task Overview_SortsByOwnerName()
    {
        AddOwner("owner-2", "Zaid Owner", "+970222", "zaid@example.com");
        AddOwner("owner-1", "Abeer Owner", "+970111", "abeer@example.com");
        AddHall("Hall A", "owner-1");
        AddHall("Hall B", "owner-2");

        var result = await CreateService().GetSubscriptionOverviewAsync(
            new AdminSubscriptionOverviewQueryDto { SortBy = AdminSubscriptionOverviewQueryDto.SortByOwnerName });

        Assert.Equal("Abeer Owner", result[0].OwnerFullName);
        Assert.Equal("Zaid Owner", result[1].OwnerFullName);
    }

    [Fact]
    public async Task Overview_SortsByDaysRemaining()
    {
        AddOwner("owner-1", "Alaa Owner", "+970111", "alaa@example.com");
        AddHall("Expiring Soon", "owner-1", cycleEnd: Today.AddDays(2));
        AddHall("Expiring Later", "owner-1", cycleEnd: Today.AddDays(20));

        var result = await CreateService().GetSubscriptionOverviewAsync(
            new AdminSubscriptionOverviewQueryDto { SortBy = AdminSubscriptionOverviewQueryDto.SortByDaysRemaining });

        var halls = result.Single().Halls;
        Assert.Equal(2, halls.Count);
        Assert.Equal("Expiring Soon", halls[0].Name);
        Assert.Equal(2, halls[0].DaysRemaining);
        Assert.Equal("Expiring Later", halls[1].Name);
        Assert.Equal(20, halls[1].DaysRemaining);
    }

    [Fact]
    public async Task Overview_ExpiredCycle_ReportsNegativeDaysRemaining()
    {
        AddOwner("owner-1", "Alaa Owner", "+970111", "alaa@example.com");
        AddHall("Overdue Hall", "owner-1", cycleEnd: Today.AddDays(-3));

        var result = await CreateService().GetSubscriptionOverviewAsync(new AdminSubscriptionOverviewQueryDto());

        var halls = result.SelectMany(g => g.Halls);
        Assert.Equal(-3, halls.Single().DaysRemaining);
    }

    // --- US-ADMIN-10: mark a hall's subscription as paid ---

    [Fact]
    public async Task MarkPaid_ApprovedUnpaid_StartsCycle_AndClearsSystemLock()
    {
        AddOwner("owner-1", "Alaa Owner", "+970111", "alaa@example.com");
        var hall = AddHall("My Hall", "owner-1", status: HallStatus.Approved, payment: HallPaymentStatus.Unpaid, systemLocked: true);

        var result = await CreateService().MarkSubscriptionPaidAsync(hall.Id);

        Assert.Equal(HallPaymentStatus.Paid, result.PaymentStatus);
        Assert.False(result.SystemLocked);
        Assert.Equal(Today, result.CycleStart);
        Assert.Equal(Today.AddDays(30), result.CycleEnd);
        Assert.Equal(120m, result.AmountIls);
        Assert.False(result.AlreadyPaidWithActiveCycle);

        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.Equal(HallPaymentStatus.Paid, reloaded!.PaymentStatus);
        Assert.False(reloaded.SystemLocked);
        Assert.Equal(Today, reloaded.SubscriptionCycleStart);
        Assert.Equal(Today.AddDays(30), reloaded.SubscriptionCycleEnd);
    }

    [Fact]
    public async Task MarkPaid_AlreadyPaidWithActiveCycle_IsIdempotent()
    {
        AddOwner("owner-1", "Alaa Owner", "+970111", "alaa@example.com");
        var hall = AddHall("My Hall", "owner-1", status: HallStatus.Approved, payment: HallPaymentStatus.Paid, cycleEnd: Today.AddDays(20));

        var result = await CreateService().MarkSubscriptionPaidAsync(hall.Id);

        Assert.True(result.AlreadyPaidWithActiveCycle);
        Assert.Equal(Today.AddDays(20), result.CycleEnd);

        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.Equal(Today.AddDays(20), reloaded!.SubscriptionCycleEnd);
    }

    [Fact]
    public async Task MarkPaid_ClearsSystemLock_ButNeverTouchesAdminLocked()
    {
        AddOwner("owner-1", "Alaa Owner", "+970111", "alaa@example.com");
        var hall = AddHall("My Hall", "owner-1", status: HallStatus.Approved, payment: HallPaymentStatus.Unpaid, systemLocked: true, isAdminLocked: true);

        var result = await CreateService().MarkSubscriptionPaidAsync(hall.Id);

        Assert.True(result.AdminLocked);

        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.True(reloaded!.IsAdminLocked);
        Assert.False(reloaded.SystemLocked);
    }

    [Fact]
    public async Task MarkPaid_NotApproved_ThrowsBusinessRule()
    {
        AddOwner("owner-1", "Alaa Owner", "+970111", "alaa@example.com");
        var hall = AddHall("Pending Hall", "owner-1", status: HallStatus.PendingReview);

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            CreateService().MarkSubscriptionPaidAsync(hall.Id));

        Assert.Equal("HallNotApproved", ex.Code);
    }

    [Fact]
    public async Task MarkPaid_NonExistentHall_ThrowsNotFound()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateService().MarkSubscriptionPaidAsync(Guid.NewGuid()));
    }

    // --- WESAL-TASK-4 (Edit 4): revoke a confirmed payment (mark not paid) ---

    [Fact]
    public async Task MarkNotPaid_PaidWithCycle_ClearsCycleAndStatus()
    {
        AddOwner("owner-1", "Alaa Owner", "+970111", "alaa@example.com");
        var hall = AddHall("My Hall", "owner-1", status: HallStatus.Approved, payment: HallPaymentStatus.Paid, cycleStart: Today.AddDays(-10), cycleEnd: Today.AddDays(20));

        var result = await CreateService().MarkSubscriptionNotPaidAsync(hall.Id);

        Assert.Equal(HallPaymentStatus.Unpaid, result.PaymentStatus);
        Assert.Null(result.CycleStart);
        Assert.Null(result.CycleEnd);
        Assert.False(result.AlreadyPaidWithActiveCycle);
        Assert.Equal(120m, result.AmountIls);

        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.Equal(HallPaymentStatus.Unpaid, reloaded!.PaymentStatus);
        Assert.Null(reloaded.SubscriptionCycleStart);
        Assert.Null(reloaded.SubscriptionCycleEnd);
    }

    [Fact]
    public async Task MarkNotPaid_AlreadyUnpaidWithNoCycle_IsIdempotentNoOp()
    {
        AddOwner("owner-1", "Alaa Owner", "+970111", "alaa@example.com");
        var hall = AddHall("My Hall", "owner-1", status: HallStatus.Approved, payment: HallPaymentStatus.Unpaid);

        var result = await CreateService().MarkSubscriptionNotPaidAsync(hall.Id);

        Assert.Equal(HallPaymentStatus.Unpaid, result.PaymentStatus);
        Assert.Null(result.CycleStart);
        Assert.Null(result.CycleEnd);

        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.Null(reloaded!.SubscriptionCycleStart);
        Assert.Null(reloaded.SubscriptionCycleEnd);
    }

    [Fact]
    public async Task MarkNotPaid_PartialCycle_IsClearedNotLeftHalfSet()
    {
        // A half-set cycle (start without end, as a failed earlier write could leave)
        // must be fully cleared rather than reported as a no-op.
        AddOwner("owner-1", "Alaa Owner", "+970111", "alaa@example.com");
        var hall = AddHall("My Hall", "owner-1", status: HallStatus.Approved, payment: HallPaymentStatus.Unpaid, cycleStart: Today.AddDays(-5));

        var result = await CreateService().MarkSubscriptionNotPaidAsync(hall.Id);

        Assert.Null(result.CycleStart);
        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.Null(reloaded!.SubscriptionCycleStart);
        Assert.Null(reloaded.SubscriptionCycleEnd);
    }

    [Fact]
    public async Task MarkNotPaid_NeverTouchesLocks()
    {
        // Revoking a payment is not a lock operation: an admin lock stays, and a system
        // lock stays, because the payment action must not silently change lock state.
        AddOwner("owner-1", "Alaa Owner", "+970111", "alaa@example.com");
        var hall = AddHall("My Hall", "owner-1", status: HallStatus.Approved, payment: HallPaymentStatus.Paid, cycleStart: Today.AddDays(-10), cycleEnd: Today.AddDays(20), systemLocked: true, isAdminLocked: true);

        var result = await CreateService().MarkSubscriptionNotPaidAsync(hall.Id);

        Assert.True(result.AdminLocked);
        Assert.True(result.SystemLocked);

        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.True(reloaded!.IsAdminLocked);
        Assert.True(reloaded.SystemLocked);
    }

    [Fact]
    public async Task MarkNotPaid_WorksRegardlessOfReviewStatusIndependence()
    {
        // Payment state is independent of review status, so a Rejected-but-Paid hall can
        // still have its payment revoked.
        AddOwner("owner-1", "Alaa Owner", "+970111", "alaa@example.com");
        var hall = AddHall("My Hall", "owner-1", status: HallStatus.Rejected, payment: HallPaymentStatus.Paid, cycleStart: Today.AddDays(-10), cycleEnd: Today.AddDays(20));

        var result = await CreateService().MarkSubscriptionNotPaidAsync(hall.Id);

        Assert.Equal(HallPaymentStatus.Unpaid, result.PaymentStatus);

        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.Equal(HallStatus.Rejected, reloaded!.Status);
        Assert.Equal(HallPaymentStatus.Unpaid, reloaded.PaymentStatus);
    }

    [Fact]
    public async Task MarkNotPaid_ClosedHall_ReopensManagementAccessViaGate()
    {
        // The reason this action exists: after revoking, the owner is blocked again with
        // the accurate payment reason rather than a stale "paid" state.
        AddOwner("owner-1", "Alaa Owner", "+970111", "alaa@example.com");
        var hall = AddHall("My Hall", "owner-1", status: HallStatus.Approved, payment: HallPaymentStatus.Paid, cycleStart: Today.AddDays(-10), cycleEnd: Today.AddDays(20));

        var before = await _context.Halls.FindAsync(hall.Id);
        HallManagementAccess.EnsureAllowed(before!);

        await CreateService().MarkSubscriptionNotPaidAsync(hall.Id);

        var after = await _context.Halls.FindAsync(hall.Id);
        var ex = Assert.Throws<BusinessRuleException>(() => HallManagementAccess.EnsureAllowed(after!));
        Assert.Equal(HallManagementAccess.PaymentRequiredCode, ex.Code);
    }

    [Fact]
    public async Task MarkNotPaid_DoesNotRequireAnyPaymentProofMessage()
    {
        // Deliberate: paid/not-paid is a direct administrative decision, independent of
        // whether the owner ever sent a proof image. No conversation/message is involved.
        AddOwner("owner-1", "Alaa Owner", "+970111", "alaa@example.com");
        var hall = AddHall("My Hall", "owner-1", status: HallStatus.Approved, payment: HallPaymentStatus.Paid, cycleStart: Today.AddDays(-10), cycleEnd: Today.AddDays(20));

        await CreateService().MarkSubscriptionNotPaidAsync(hall.Id);

        Assert.Empty(_context.Conversations);
        Assert.Empty(_context.Messages);
    }

    [Fact]
    public async Task MarkNotPaid_NonExistentHall_ThrowsNotFound()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateService().MarkSubscriptionNotPaidAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task MarkNotPaid_DeletedHall_ThrowsNotFound()
    {
        AddOwner("owner-1", "Alaa Owner", "+970111", "alaa@example.com");
        var hall = AddHall("My Hall", "owner-1", status: HallStatus.Approved, payment: HallPaymentStatus.Paid, isDeleted: true);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateService().MarkSubscriptionNotPaidAsync(hall.Id));
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

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        public FakeCurrentUser(string? userId, bool auth, string role)
        {
            UserId = userId;
            IsAuthenticated = auth;
            Roles = new[] { role };
        }

        public string? UserId { get; }
        public string? UserName => "admin";
        public string? Email => "admin@example.com";
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles { get; }
    }
}