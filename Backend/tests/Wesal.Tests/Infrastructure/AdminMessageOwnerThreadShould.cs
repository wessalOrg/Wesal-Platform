using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Admin;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;
using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// WESAL-TASK-10, Edit 15, second half: the Admin "Message" action on a hall.
///
/// Edit 4 gave the Admin a way to SEND an owner a message, and Edit 17's "رسالة" action is
/// that endpoint. It is a send, though: it requires non-empty content, so it cannot be used
/// to merely OPEN a hall's thread. A "Message" button in the hall list or the hall-review
/// view wants the latter — resolve the owner/Admin thread for this hall, creating it if
/// needed, and hand back enough context to render it.
///
/// What this file pins:
///   - the same deterministic key as Edit 4 and Edit 11, (HallId, HallOwnerId), so repeated
///     calls resolve to one thread and never duplicate it;
///   - every hall status, including the locked ones, because an Admin must be able to open a
///     conversation about a lock they applied. This is the reverse direction of Edit 10's
///     owner-side gate and is the case most likely to be blocked by accident;
///   - the hall/owner context the client needs, so the button can be wired up later without
///     a second round trip.
/// </summary>
public class AdminMessageOwnerThreadShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public AdminMessageOwnerThreadShould()
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
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.Admin)).GetAwaiter().GetResult();
        _userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }

    // --- every hall status, because the point of the action is to reach the owner ---

    [Fact]
    public async Task ResolvesTheThread_ForAPendingHall()
    {
        var owner = await CreateOwnerAsync("pending@example.com");
        var hall = AddHall(owner.Id, HallStatus.PendingReview);

        var result = await CreateService().GetOwnerConversationAsync(hall.Id);

        Assert.Equal(hall.Id, result.HallId);
        // A PendingReview hall has no thread yet, so resolving it has to CREATE one.
        Assert.False(result.IsExisting);
    }

    [Fact]
    public async Task ResolvesTheThread_ForAnApprovedHall()
    {
        var owner = await CreateOwnerAsync("approved@example.com");
        var hall = AddHall(owner.Id, HallStatus.Approved);

        var result = await CreateService().GetOwnerConversationAsync(hall.Id);

        Assert.Equal(hall.Id, result.HallId);
    }

    [Fact]
    public async Task ResolvesTheThread_ForARejectedHall()
    {
        var owner = await CreateOwnerAsync("rejected@example.com");
        var hall = AddHall(owner.Id, HallStatus.Rejected);

        var result = await CreateService().GetOwnerConversationAsync(hall.Id);

        Assert.Equal(hall.Id, result.HallId);
    }

    /// <summary>
    /// The reverse direction of Edit 10's lock gate. That gate stops a locked OWNER; it must
    /// not stop the Admin from opening the thread, because the lock is usually the reason the
    /// two need to talk. Asserted for the manual lock, the system lock and both together.
    /// </summary>
    [Fact]
    public async Task ResolvesTheThread_ForAnAdminLockedHall()
    {
        var owner = await CreateOwnerAsync("adminlocked@example.com");
        var hall = AddHall(owner.Id, HallStatus.Approved);
        hall.IsAdminLocked = true;
        _context.SaveChanges();

        var result = await CreateService().GetOwnerConversationAsync(hall.Id);

        Assert.Equal(hall.Id, result.HallId);
    }

    [Fact]
    public async Task ResolvesTheThread_ForASystemLockedHall()
    {
        var owner = await CreateOwnerAsync("systemlocked@example.com");
        var hall = AddHall(owner.Id, HallStatus.Approved);
        hall.SystemLocked = true;
        _context.SaveChanges();

        var result = await CreateService().GetOwnerConversationAsync(hall.Id);

        Assert.Equal(hall.Id, result.HallId);
    }

    [Fact]
    public async Task ResolvesTheThread_ForADoublyLockedHall()
    {
        var owner = await CreateOwnerAsync("bothlocked@example.com");
        var hall = AddHall(owner.Id, HallStatus.Approved);
        hall.IsAdminLocked = true;
        hall.SystemLocked = true;
        _context.SaveChanges();

        var result = await CreateService().GetOwnerConversationAsync(hall.Id);

        Assert.Equal(hall.Id, result.HallId);
    }

    /// <summary>
    /// An unpaid hall is not locked, but it is the case the whole feature exists for, so the
    /// thread must resolve for it too.
    /// </summary>
    [Fact]
    public async Task ResolvesTheThread_ForAnApprovedUnpaidHall()
    {
        var owner = await CreateOwnerAsync("unpaid@example.com");
        var hall = AddHall(owner.Id, HallStatus.Approved);
        hall.PaymentStatus = HallPaymentStatus.Unpaid;
        _context.SaveChanges();

        var result = await CreateService().GetOwnerConversationAsync(hall.Id);

        Assert.Equal(hall.Id, result.HallId);
    }

    // --- determinism: one thread per (HallId, HallOwnerId), never a duplicate ---

    [Fact]
    public async Task RepeatedCalls_AlwaysResolveTheSameSingleThread()
    {
        var owner = await CreateOwnerAsync("repeat@example.com");
        var hall = AddHall(owner.Id, HallStatus.Approved);

        var first = await CreateService().GetOwnerConversationAsync(hall.Id);
        var second = await CreateService().GetOwnerConversationAsync(hall.Id);
        var third = await CreateService().GetOwnerConversationAsync(hall.Id);

        Assert.Equal(first.ConversationId, second.ConversationId);
        Assert.Equal(first.ConversationId, third.ConversationId);
        Assert.Single(_context.Conversations);
    }

    /// <summary>
    /// The same guarantee across two different Admins. Edit 4's whole reason for keying on
    /// (HallId, HallOwnerId) rather than on the acting Admin was that Admins must converge on
    /// one thread; this is the assertion for that from the other side.
    /// </summary>
    [Fact]
    public async Task TwoDifferentAdmins_ResolveTheSameSingleThread()
    {
        var owner = await CreateOwnerAsync("twoadmins@example.com");
        var hall = AddHall(owner.Id, HallStatus.Approved);
        var secondAdmin = await CreateAdminAsync("second-admin@example.com");

        var first = await CreateService("admin-1").GetOwnerConversationAsync(hall.Id);
        var other = await CreateService(secondAdmin.Id).GetOwnerConversationAsync(hall.Id);

        Assert.Equal(first.ConversationId, other.ConversationId);
        Assert.Single(_context.Conversations);
    }

    /// <summary>
    /// It must also land on the thread an existing payment notice already used, or the admin
    /// would see an empty new thread while the proof sits in another one.
    /// </summary>
    [Fact]
    public async Task ResolvesToTheThreadThePaymentNoticeAlreadyUsed()
    {
        var owner = await CreateOwnerAsync("proof@example.com");
        var hall = AddHall(owner.Id, HallStatus.Approved);
        hall.PaymentStatus = HallPaymentStatus.Unpaid;
        _context.SaveChanges();

        // The Admin's existing send (Edit 4/17) creates and populates the thread.
        var admin = await CreateAdminAsync("notice-admin@example.com");
        var sent = await CreateService(admin.Id).SendMessageToOwnerAsync(hall.Id, "please confirm payment");

        var resolved = await CreateService(admin.Id).GetOwnerConversationAsync(hall.Id);

        Assert.Equal(sent.ConversationId, resolved.ConversationId);
        Assert.Single(_context.Conversations);
    }

    /// <summary>
    /// Edit 11 made the owner-side ContactAdmin action resolve on the same key, so the two
    /// must not fork a thread between them.
    /// </summary>
    [Fact]
    public async Task ResolvesToTheThreadTheOwnersContactAdminCallCreated()
    {
        var owner = await CreateOwnerAsync("contact@example.com");
        var hall = AddHall(owner.Id, HallStatus.Approved);

        var contactAdmin = await CreateOwnerContactAdminService(owner.Id).ContactAdminAsync(hall.Id);

        var resolved = await CreateService().GetOwnerConversationAsync(hall.Id);

        Assert.Equal(contactAdmin.ConversationId, resolved.ConversationId);
        Assert.Single(_context.Conversations);
    }

    // --- response context ---

    [Fact]
    public async Task TheResponseCarriesTheHallAndOwnerContextTheButtonNeeds()
    {
        var owner = await CreateOwnerAsync("context@example.com");
        var hall = AddHall(owner.Id, HallStatus.Approved, "Al-Rashid Wedding Hall");

        var result = await CreateService().GetOwnerConversationAsync(hall.Id);

        Assert.NotEqual(Guid.Empty, result.ConversationId);
        Assert.Equal(hall.Id, result.HallId);
        Assert.Equal("Al-Rashid Wedding Hall", result.HallName);
        Assert.Equal(owner.Id, result.OwnerUserId);
    }

    [Fact]
    public async Task TheResponseReportsWhetherTheThreadAlreadyExisted()
    {
        var owner = await CreateOwnerAsync("existing@example.com");
        var hall = AddHall(owner.Id, HallStatus.Approved);

        var created = await CreateService().GetOwnerConversationAsync(hall.Id);
        var found = await CreateService().GetOwnerConversationAsync(hall.Id);

        Assert.False(created.IsExisting);
        Assert.True(found.IsExisting);
    }

    // --- guards ---

    [Fact]
    public async Task ANonExistentHall_ThrowsNotFound()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateService().GetOwnerConversationAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task ADeletedHall_ThrowsNotFound()
    {
        var owner = await CreateOwnerAsync("deleted@example.com");
        var hall = AddHall(owner.Id, HallStatus.Approved);
        hall.IsDeleted = true;
        _context.SaveChanges();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateService().GetOwnerConversationAsync(hall.Id));
    }

    [Fact]
    public async Task AHallWithNoOwner_Throws()
    {
        // A hall row that never got an owner attached. There is no counterparty to open a
        // conversation with, so this must fail loudly rather than create an orphan thread.
        var hall = AddHall("   ", HallStatus.Approved);

        await Assert.ThrowsAsync<ValidationException>(() =>
            CreateService().GetOwnerConversationAsync(hall.Id));
    }

    // --- authorization ---

    /// <summary>
    /// The "Message" action resolves a real counterparty's thread, so it must be reachable by
    /// an Admin and by nobody else. It carries no [Authorize] of its own and relies on the
    /// controller-level policy, so this asserts the whole chain exists: the controller requires
    /// the Admin role, and the policy behind that name really is a role check on Admin.
    ///
    /// Pinned by reflection because the service layer cannot see it — a hall owner calling
    /// this action would be refused there only because they are not a participant, which is a
    /// different reason arriving by coincidence.
    /// </summary>
    [Fact]
    public void TheActionIsAdminOnly()
    {
        var controller = typeof(Wesal.API.Controllers.AdminController);
        var action = typeof(Wesal.API.Controllers.AdminController)
            .GetMethod(nameof(Wesal.API.Controllers.AdminController.GetOwnerConversation));

        Assert.NotNull(action);

        var controllerPolicy = controller
            .GetCustomAttributes(typeof(Microsoft.AspNetCore.Authorization.AuthorizeAttribute), inherit: true)
            .Cast<Microsoft.AspNetCore.Authorization.AuthorizeAttribute>()
            .SingleOrDefault();

        Assert.NotNull(controllerPolicy);
        Assert.Equal(ApplicationPolicies.RequireAdmin, controllerPolicy!.Policy);

        // The action adds no weaker requirement of its own.
        var actionPolicies = action!
            .GetCustomAttributes(typeof(Microsoft.AspNetCore.Authorization.AuthorizeAttribute), inherit: true)
            .Cast<Microsoft.AspNetCore.Authorization.AuthorizeAttribute>()
            .ToList();

        Assert.DoesNotContain(actionPolicies, p => p.Policy == ApplicationPolicies.RequireAuthenticatedUser);
    }

    // --- harness ---

    private async Task<ApplicationUser> CreateOwnerAsync(string email)
    {
        var user = new ApplicationUser
        {
            FullName = "Hall Owner",
            Email = email,
            UserName = email,
            PhoneNumber = "+970599111111"
        };
        await _userManager.CreateAsync(user, "Password123!");
        await _userManager.AddToRoleAsync(user, ApplicationRoles.HallOwner);
        return user;
    }

    private async Task<ApplicationUser> CreateAdminAsync(string email)
    {
        var user = new ApplicationUser { FullName = "Admin User", Email = email, UserName = email };
        await _userManager.CreateAsync(user, "Password123!");
        await _userManager.AddToRoleAsync(user, ApplicationRoles.Admin);
        return user;
    }

    private Hall AddHall(string ownerId, HallStatus status, string name = "Test Hall")
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
            MainImageUrl = "https://cdn.example.com/main.jpg",
            OwnerId = ownerId,
            Status = status,
            PaymentStatus = HallPaymentStatus.Paid
        };
        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    private AdminHallReviewService CreateService(string? adminId = null)
        => new(
            new AdminDashboardRepository(_context),
            new HallRepository(_context),
            new UnitOfWork(_context),
            new ConversationRepository(_context),
            new MessageRepository(_context),
            new FakeCurrentUser(adminId ?? "admin-1", true, ApplicationRoles.Admin),
            new FakeDateTime(new DateTimeOffset(2026, 8, 15, 10, 0, 0, TimeSpan.Zero)),
            new FakeNotifier(),
            _userManager,
            new FakeDocumentStorage(),
            new FakeNotificationService(),
            new RecordingNotificationDispatcher(),
            NullLogger<AdminHallReviewService>.Instance);

    /// <summary>
    /// The owner-side ContactAdmin action (Edit 11), wired against the same database so the
    /// two resolution paths can be shown to converge on one thread.
    /// </summary>
    private Wesal.Infrastructure.Conversations.ConversationService CreateOwnerContactAdminService(string ownerId)
        => new(
            new ConversationRepository(_context),
            new MessageRepository(_context),
            new FakeBookingRejectionService(),
            new NoOpBookingAcceptanceService(),
            new HallRepository(_context),
            new FakeCurrentUser(ownerId, true, ApplicationRoles.HallOwner),
            new FakeNotifier(),
            new FakeDocumentStorage());

    private sealed class FakeBookingRejectionService : IBookingRejectionService
    {
        public Task<RejectBookingResultDto> RejectBookingAsync(
            Guid hallId, Guid bookingId, RejectBookingRequestDto request, CancellationToken cancellationToken = default)
            => Task.FromResult(new RejectBookingResultDto());

        public Task<int> DeliverPendingRejectionNotificationsAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(0);
    }

    private sealed class FakeDocumentStorage : IDocumentStorage
    {
        public string Root { get; } = Path.Combine(Path.GetTempPath(), "wesal-edit15-docs");

        public string OwnerDocumentsDirectory(string ownerId)
            => Path.Combine(Root, "documents", "owners", ownerId);

        public string ConversationAttachmentsDirectory(Guid conversationId)
            => Path.Combine(Root, "documents", "conversations", conversationId.ToString(), "attachments");
    }

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        public FakeCurrentUser(string? userId, bool authenticated, params string[] roles)
        {
            UserId = userId;
            IsAuthenticated = authenticated;
            Roles = roles;
        }

        public string? UserId { get; }

        public string? UserName => "test";

        public string? Email => "test@example.com";

        public bool IsAuthenticated { get; }

        public IReadOnlyList<string> Roles { get; }
    }

    private sealed class FakeDateTime : IDateTime
    {
        public FakeDateTime(DateTimeOffset now) => Now = now;

        public DateTimeOffset Now { get; }
    }

    private sealed class FakeNotifier : IConversationNotifier
    {
        public Task NotifyMessageSentAsync(MessageSentEvent message, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }
}
