using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Admin;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.OwnerDashboard;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// WESAL-TASK-2+3: an owner may edit their hall at any approval status, and the moment
/// the edit is saved an Admin reading the hall sees exactly the edited data.
///
/// The two services run over the same database on purpose. The owner side goes through
/// <see cref="OwnerHallService"/> (ownership resolution + the update transaction) and the
/// admin side through <see cref="AdminHallReviewService"/> / the admin dashboard
/// repository, i.e. the real seeker-of-record read an Admin uses to review a submission,
/// not the owner's own echo of what it just sent.
/// </summary>
public class OwnerEditAdminVisibilityShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public OwnerEditAdminVisibilityShould()
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

    private async Task<ApplicationUser> CreateUserAsync(string email, string role, string phone)
    {
        var user = new ApplicationUser { FullName = "Test User", Email = email, UserName = email, PhoneNumber = phone };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded) throw new Exception(string.Join(",", result.Errors.Select(e => e.Description)));
        await _userManager.AddToRoleAsync(user, role);
        return user;
    }

    private Hall AddHall(string ownerId, string name, HallStatus status)
    {
        var hall = new Hall
        {
            Name = name,
            Address = "حي الشجاعية",
            DetailedAddress = "بجوار دوار النابلسي",
            Region = HallRegion.Gaza,
            Capacity = 200,
            Price = 1500,
            ShowPrice = true,
            ContactPhone = "+970599111111",
            Description = "Spacious hall",
            MainImageUrl = "https://cdn.example.com/old-cover.jpg",
            OwnerId = ownerId,
            Status = status,
            PaymentStatus = HallPaymentStatus.Paid,
            IsDeleted = false
        };
        hall.Images.Add(new HallImage { HallId = hall.Id, Url = "https://cdn.example.com/old-1.jpg", DisplayOrder = 0 });
        hall.Images.Add(new HallImage { HallId = hall.Id, Url = "https://cdn.example.com/old-2.jpg", DisplayOrder = 1 });
        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    private OwnerHallService CreateOwnerService(string userId)
        => new(_userManager, new FakeCurrentUser(userId, true, ApplicationRoles.HallOwner),
            new OwnerDashboardRepository(_context), new UnitOfWork(_context));

    private AdminHallReviewService CreateAdminService()
        => new(new AdminDashboardRepository(_context), new HallRepository(_context), new UnitOfWork(_context),
            new ConversationRepository(_context), new MessageRepository(_context),
            new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin),
            new FakeDateTime(new DateTimeOffset(2026, 8, 15, 10, 0, 0, TimeSpan.Zero)),
            new FakeNotifier(), _userManager, new FakeDocumentStorage(),
            NullLogger<AdminHallReviewService>.Instance);

    private static UpdateOwnerHallRequest EditRequest(
        string name = "قاعة النخبة المحدثة",
        int capacity = 450) => new()
    {
        Name = name,
        Address = "حي الرمال",
        DetailedAddress = "شارع 8، بجوار مسجد النور",
        Region = HallRegion.Gaza,
        Capacity = capacity,
        Price = 2750m,
        ShowPrice = true,
        ContactPhone = "+970599999999",
        Description = "Newly renovated hall",
        YouTubeVideoUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        MainImageUrl = "https://cdn.example.com/new-cover.jpg",
        OtherFeatures = "مكيف مركزي",
        Photos =
        [
            new UpdateOwnerHallPhotoDto { Url = "https://cdn.example.com/new-1.jpg", DisplayOrder = 0 },
            new UpdateOwnerHallPhotoDto { Url = "https://cdn.example.com/new-2.jpg", DisplayOrder = 1 }
        ]
    };

    private static void AssertAdminSeesTheEdit(AdminHallDetailDto detail)
    {
        Assert.Equal("قاعة النخبة المحدثة", detail.Name);
        Assert.Equal("حي الرمال", detail.Address);
        Assert.Equal("شارع 8، بجوار مسجد النور", detail.DetailedAddress);
        Assert.Equal(450, detail.Capacity);
        Assert.Equal(2750m, detail.Price);
        Assert.Equal("Newly renovated hall", detail.Description);
        Assert.Equal("https://cdn.example.com/new-cover.jpg", detail.MainImageUrl);
        Assert.Equal("مكيف مركزي", detail.OtherFeatures);
        Assert.Equal("https://www.youtube.com/watch?v=dQw4w9WgXcQ", detail.YouTubeVideoUrl);

        // The gallery is the new set only: the previous photos were soft-deleted, and the
        // admin read filters soft-deleted images out, so no stale photo can appear.
        Assert.Equal(
            ["https://cdn.example.com/new-1.jpg", "https://cdn.example.com/new-2.jpg"],
            detail.PhotoUrls.OrderBy(url => url, StringComparer.Ordinal).ToArray());
    }

    [Theory]
    [InlineData(HallStatus.Approved)]
    [InlineData(HallStatus.PendingReview)]
    public async Task OwnerEdit_ApprovedOrPendingHall_IsVisibleToAdminImmediately(HallStatus status)
    {
        var owner = await CreateUserAsync($"owner-{status}@example.com", ApplicationRoles.HallOwner, "+970599100001");
        var hall = AddHall(owner.Id, "قاعة النخبة", status);
        var admin = CreateAdminService();

        // The admin sees the pre-edit data first, so a later match cannot be a coincidence.
        var before = await admin.GetAdminHallDetailAsync(hall.Id);
        Assert.Equal("قاعة النخبة", before.Name);
        Assert.Equal("حي الشجاعية", before.Address);
        Assert.Equal("https://cdn.example.com/old-cover.jpg", before.MainImageUrl);
        Assert.Contains(before.PhotoUrls, url => url == "https://cdn.example.com/old-1.jpg");

        await CreateOwnerService(owner.Id).UpdateOwnedHallAsync(hall.Id, EditRequest());

        var after = await admin.GetAdminHallDetailAsync(hall.Id);
        AssertAdminSeesTheEdit(after);
        Assert.Equal(status, after.Status);
    }

    [Fact]
    public async Task OwnerEdit_RejectedHall_IsVisibleToAdminImmediately_AndStillResubmits()
    {
        // The pre-existing FR-ADM-01 resubmission rule (Rejected + edit => PendingReview)
        // keeps working; this pins that it coexists with editing-while-pending.
        var owner = await CreateUserAsync("owner-rejected@example.com", ApplicationRoles.HallOwner, "+970599100002");
        var hall = AddHall(owner.Id, "قاعة النخبة", HallStatus.Rejected);
        var admin = CreateAdminService();

        var result = await CreateOwnerService(owner.Id).UpdateOwnedHallAsync(hall.Id, EditRequest());

        Assert.Equal(HallStatus.PendingReview, result.Status);

        var after = await admin.GetAdminHallDetailAsync(hall.Id);
        AssertAdminSeesTheEdit(after);
        Assert.Equal(HallStatus.PendingReview, after.Status);
    }

    [Fact]
    public async Task OwnerEdit_ApprovedHall_DoesNotChangeItsApprovalStatus()
    {
        var owner = await CreateUserAsync("owner-approved@example.com", ApplicationRoles.HallOwner, "+970599100003");
        var hall = AddHall(owner.Id, "قاعة النخبة", HallStatus.Approved);

        await CreateOwnerService(owner.Id).UpdateOwnedHallAsync(hall.Id, EditRequest());

        var after = await CreateAdminService().GetAdminHallDetailAsync(hall.Id);
        Assert.Equal(HallStatus.Approved, after.Status);
    }

    [Fact]
    public async Task AdminRead_NeverServesStaleData_AcrossRepeatedEdits()
    {
        var owner = await CreateUserAsync("owner-repeat@example.com", ApplicationRoles.HallOwner, "+970599100004");
        var hall = AddHall(owner.Id, "قاعة النخبة", HallStatus.PendingReview);
        var admin = CreateAdminService();

        var first = EditRequest(name: "المراجعة الأولى", capacity: 111);
        await CreateOwnerService(owner.Id).UpdateOwnedHallAsync(hall.Id, first);

        var afterFirst = await admin.GetAdminHallDetailAsync(hall.Id);
        Assert.Equal("المراجعة الأولى", afterFirst.Name);
        Assert.Equal(111, afterFirst.Capacity);

        var second = EditRequest(name: "المراجعة الثانية", capacity: 222);
        await CreateOwnerService(owner.Id).UpdateOwnedHallAsync(hall.Id, second);

        var afterSecond = await admin.GetAdminHallDetailAsync(hall.Id);
        Assert.Equal("المراجعة الثانية", afterSecond.Name);
        Assert.Equal(222, afterSecond.Capacity);
    }

    [Fact]
    public async Task OwnerEdit_AnotherOwnersHall_IsRejected_AndAdminSeesNoChange()
    {
        var owner = await CreateUserAsync("owner-a@example.com", ApplicationRoles.HallOwner, "+970599100005");
        var other = await CreateUserAsync("owner-b@example.com", ApplicationRoles.HallOwner, "+970599100006");
        var hall = AddHall(other.Id, "قاعة النخبة", HallStatus.Approved);
        var admin = CreateAdminService();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateOwnerService(owner.Id).UpdateOwnedHallAsync(hall.Id, EditRequest()));

        var after = await admin.GetAdminHallDetailAsync(hall.Id);
        Assert.Equal("قاعة النخبة", after.Name);
        Assert.Equal("حي الشجاعية", after.Address);
        Assert.Equal("https://cdn.example.com/old-cover.jpg", after.MainImageUrl);
    }

    [Fact]
    public async Task OwnerEdit_SeekerRoleUser_IsRejected_AndAdminSeesNoChange()
    {
        // A registered (seeker) account is not a hall owner and owns no hall, so
        // ownership resolution must reject the edit.
        var owner = await CreateUserAsync("owner-c@example.com", ApplicationRoles.HallOwner, "+970599100007");
        var seeker = await CreateUserAsync("seeker@example.com", ApplicationRoles.RegisteredUser, "+970599100008");
        var hall = AddHall(owner.Id, "قاعة النخبة", HallStatus.Approved);
        var admin = CreateAdminService();

        var seekerService = new OwnerHallService(_userManager,
            new FakeCurrentUser(seeker.Id, true, ApplicationRoles.RegisteredUser),
            new OwnerDashboardRepository(_context), new UnitOfWork(_context));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            seekerService.UpdateOwnedHallAsync(hall.Id, EditRequest()));

        var after = await admin.GetAdminHallDetailAsync(hall.Id);
        Assert.Equal("قاعة النخبة", after.Name);
        Assert.Equal("https://cdn.example.com/old-cover.jpg", after.MainImageUrl);
    }

    [Fact]
    public async Task OwnerEdit_EndpointIsGuardedByTheHallOwnerPolicy()
    {
        // The role gate lives on the controller policy, which is what stops a seeker
        // before ownership is even resolved.
        var controller = typeof(Wesal.API.Controllers.OwnerController);
        var authorize = controller
            .GetCustomAttributes(typeof(Microsoft.AspNetCore.Authorization.AuthorizeAttribute), inherit: true)
            .Cast<Microsoft.AspNetCore.Authorization.AuthorizeAttribute>()
            .SingleOrDefault();

        Assert.NotNull(authorize);
        Assert.Equal(ApplicationPolicies.RequireHallOwner, authorize!.Policy);
    }

    [Fact]
    public async Task OwnerEdit_StillBlockedByPaymentAndLockGates()
    {
        // WESAL-TASK-2+3 removed only the approval-status gate. The shipped Task-1
        // subscription gates must still reject the edit.
        var owner = await CreateUserAsync("owner-locked@example.com", ApplicationRoles.HallOwner, "+970599100009");

        var unpaid = AddHall(owner.Id, " unpaid", HallStatus.Approved);
        unpaid.PaymentStatus = HallPaymentStatus.Unpaid;
        _context.SaveChanges();
        var unpaidError = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            CreateOwnerService(owner.Id).UpdateOwnedHallAsync(unpaid.Id, EditRequest()));
        Assert.Equal(HallManagementAccess.PaymentRequiredCode, unpaidError.Code);

        var adminLocked = AddHall(owner.Id, "locked", HallStatus.Approved);
        adminLocked.IsAdminLocked = true;
        _context.SaveChanges();
        var lockedError = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            CreateOwnerService(owner.Id).UpdateOwnedHallAsync(adminLocked.Id, EditRequest()));
        Assert.Equal(HallManagementAccess.HallLockedCode, lockedError.Code);

        // And the failed edits persisted nothing.
        var untouched = await _context.Halls.AsNoTracking().SingleAsync(h => h.Id == adminLocked.Id);
        Assert.Equal("locked", untouched.Name);
        Assert.Equal("حي الشجاعية", untouched.Address);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        private readonly string[] _roles;

        public FakeCurrentUser(string? userId, bool auth, params string[] roles)
        {
            UserId = userId;
            IsAuthenticated = auth;
            _roles = roles;
        }

        public string? UserId { get; }
        public string? UserName => "test";
        public string? Email => "test@example.com";
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles => _roles;
    }

    private sealed class FakeDateTime : IDateTime
    {
        private readonly DateTimeOffset _now;
        public FakeDateTime(DateTimeOffset now) => _now = now;
        public DateTimeOffset Now => _now;
        public DateTime UtcNow => _now.UtcDateTime;
    }

    private sealed class FakeNotifier : IConversationNotifier
    {
        public Task NotifyMessageSentAsync(MessageSentEvent @event, CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private sealed class FakeDocumentStorage : IDocumentStorage
    {
        public string Root => Path.Combine(Path.GetTempPath(), "wesal-test-documents");
        public string OwnerDocumentsDirectory(string ownerId) => Path.Combine(Root, "documents", "owners", ownerId);
            public string ConversationAttachmentsDirectory(Guid conversationId) => Path.Combine(Root, "documents", "conversations", conversationId.ToString(), "attachments");
    }
}
