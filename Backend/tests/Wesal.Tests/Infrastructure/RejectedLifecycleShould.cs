using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Admin;
using Wesal.Infrastructure.Bookings;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Documents;
using Wesal.Infrastructure.Halls;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.OwnerDashboard;
using Wesal.Infrastructure.Profile;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Rejected-hall lifecycle (Edits 26/27) against the real stores, reusing the existing
/// <see cref="HallStatus"/> architecture, approval/rejection services and subscription
/// infrastructure: a rejected hall stays accessible and editable to its owner, stays
/// queryable as Rejected (never leaking into pending/approved surfaces), can be
/// approved back to Approved with full visibility, and payment proof lives only in
/// conversation attachments — the obsolete receipt field is gone.
/// </summary>
public class RejectedLifecycleShould : IDisposable
{
    private static readonly byte[] JpegBytes =
        [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01];

    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly string _mediaRoot;
    private readonly string _documentsRoot;

    public RejectedLifecycleShould()
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
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.Admin)).GetAwaiter().GetResult();
        _userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
        _mediaRoot = Path.Combine(Path.GetTempPath(), "wesal-test-media-" + Guid.NewGuid());
        _documentsRoot = Path.Combine(Path.GetTempPath(), "wesal-test-docs-" + Guid.NewGuid());
    }

    private async Task<ApplicationUser> CreateUserAsync(
        string email,
        string phone,
        string role,
        string? identityDocumentUrl = null)
    {
        var user = new ApplicationUser
        {
            FullName = "Test User",
            Email = email,
            UserName = email,
            PhoneNumber = phone,
            IdentityDocumentUrl = identityDocumentUrl
        };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded) throw new Exception(string.Join(",", result.Errors.Select(e => e.Description)));
        await _userManager.AddToRoleAsync(user, role);
        return user;
    }

    private Hall AddHall(
        string ownerId,
        HallStatus status = HallStatus.PendingReview,
        HallPaymentStatus payment = HallPaymentStatus.Paid)
    {
        var hall = new Hall
        {
            Name = "Grand Hall",
            Address = "حي الرمال",
            Region = HallRegion.Gaza,
            Capacity = 200,
            Price = 1500,
            ShowPrice = true,
            ContactPhone = "+970599111111",
            Description = "Spacious hall",
            OwnerId = ownerId,
            Status = status,
            PaymentStatus = payment,
            IsDeleted = false,
            MainImageUrl = "/uploads/halls/cover.jpg",
            HourlySlotStart = new TimeOnly(9, 0),
            HourlySlotEnd = new TimeOnly(21, 0),
            ShowBookedSlots = true
        };
        hall.Images.Add(new HallImage { HallId = hall.Id, Url = "/uploads/halls/g1.jpg", DisplayOrder = 0 });
        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    private static FakeDateTime TestClock()
        => new(new DateTimeOffset(2026, 10, 1, 10, 0, 0, TimeSpan.Zero));

    private OwnerHallService CreateOwnerHallService(string ownerId)
        => new(_userManager, new FakeCurrentUser(ownerId, true, ApplicationRoles.HallOwner),
            new OwnerDashboardRepository(_context), new BookingRepository(_context),
            new LocalHallMediaStorage(Options.Create(new HallMediaOptions { Directory = _mediaRoot })),
            new UnitOfWork(_context), NullLogger<OwnerHallService>.Instance);

    private AdminHallService CreateAdminHallService(string adminId)
        => new(new HallRepository(_context), new UnitOfWork(_context),
            new FakeHallSearchIndexer(), new ConversationRepository(_context),
            new MessageRepository(_context), new RecordingConversationNotifier(),
            new FakeCurrentUser(adminId, true, ApplicationRoles.Admin), TestClock(),
            new FakeNotificationService(), new RecordingNotificationDispatcher(),
            NullLogger<AdminHallService>.Instance);

    private AdminHallReviewService CreateAdminReviewService(string adminId)
        => new(new AdminDashboardRepository(_context), new HallRepository(_context),
            new UnitOfWork(_context), new ConversationRepository(_context),
            new MessageRepository(_context),
            new FakeCurrentUser(adminId, true, ApplicationRoles.Admin), TestClock(),
            new RecordingConversationNotifier(), _userManager,
            new DocumentStorage(Options.Create(new DocumentStorageOptions { Directory = _documentsRoot })),
            new FakeNotificationService(), new RecordingNotificationDispatcher(),
            NullLogger<AdminHallReviewService>.Instance);

    private HourlySlotService CreateSeekerService(string seekerId)
        => new(new HallRepository(_context), new BookingRepository(_context),
            new UnitOfWork(_context), new FakeCurrentUser(seekerId, true, ApplicationRoles.RegisteredUser),
            new RecordingOwnerBookingRequestNotifier(), new RecordingNotificationDispatcher());

    private HallCreationService CreateCreationService(string ownerId)
        => new(new FakeCurrentUser(ownerId, true, ApplicationRoles.HallOwner),
            new HallRepository(_context), new UnitOfWork(_context),
            new LocalHallMediaStorage(Options.Create(new HallMediaOptions { Directory = _mediaRoot })),
            _userManager, new RecordingNotificationDispatcher(), NullLogger<HallCreationService>.Instance);

    private static UpdateOwnerHallRequest CorrectionRequest(Hall hall) => new()
    {
        Name = "Grand Hall Corrected",
        Address = hall.Address,
        Region = hall.Region,
        Capacity = hall.Capacity,
        Price = hall.Price,
        ShowPrice = hall.ShowPrice,
        ContactPhone = hall.ContactPhone,
        Description = "Corrected description",
        Features = [],
        Photos =
        [
            new UpdateOwnerHallPhotoDto { Url = "/uploads/halls/g1.jpg", DisplayOrder = 0 }
        ],
        HourlySlotStart = new TimeOnly(9, 0),
        HourlySlotEnd = new TimeOnly(21, 0)
    };

    private static CreateHallRequest ValidCreateRequest() => new()
    {
        Name = "Test Hall",
        ContactPhone = "+972599123456",
        Region = "Gaza",
        Address = "حي الشجاعية",
        Description = "Beautiful hall for weddings",
        Capacity = 300,
        Price = 1000,
        HourlySlotStart = new TimeOnly(8, 0),
        HourlySlotEnd = new TimeOnly(22, 0)
    };

    // ---------- Edit 26: rejected owner access + correction ----------

    [Fact]
    public async Task RejectedOwner_CanAccess_RejectedHall()
    {
        var owner = await CreateUserAsync("o1@example.com", "+970599100001", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, HallStatus.Rejected);

        var details = await CreateOwnerHallService(owner.Id).GetOwnedHallDetailsAsync(hall.Id);

        Assert.Equal(hall.Id, details.HallId);
        Assert.Equal(HallStatus.Rejected, details.Status);
    }

    [Fact]
    public async Task RejectedOwner_CanEdit_ToCorrectRejection()
    {
        var owner = await CreateUserAsync("o2@example.com", "+970599100002", ApplicationRoles.HallOwner);
        var admin = await CreateUserAsync("a2@example.com", "+970599100003", ApplicationRoles.Admin);
        var hall = AddHall(owner.Id, HallStatus.PendingReview);

        await CreateAdminReviewService(admin.Id).RejectHallAsync(
            hall.Id, new AdminRejectHallRequestDto { Reason = "Photos are blurry." });

        var corrected = await CreateOwnerHallService(owner.Id)
            .UpdateOwnedHallAsync(hall.Id, CorrectionRequest(hall));

        Assert.Equal("Grand Hall Corrected", corrected.HallName);
        // The correction flow re-queues the hall for review; it does not bypass it.
        Assert.Equal(HallStatus.PendingReview, corrected.Status);
    }

    [Fact]
    public async Task RejectedHall_StaysOutOf_PendingApprovedAndPublicSurfaces()
    {
        var owner = await CreateUserAsync("o3@example.com", "+970599100004", ApplicationRoles.HallOwner);
        var seeker = await CreateUserAsync("s3@example.com", "+970599100005", ApplicationRoles.RegisteredUser);
        var admin = await CreateUserAsync("a3@example.com", "+970599100006", ApplicationRoles.Admin);
        var hall = AddHall(owner.Id, HallStatus.PendingReview);

        await CreateAdminReviewService(admin.Id).RejectHallAsync(
            hall.Id, new AdminRejectHallRequestDto { Reason = "Incomplete address." });
        var date = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);

        // Still Rejected and distinguishable everywhere it matters.
        var adminDetail = await CreateAdminReviewService(admin.Id).GetAdminHallDetailAsync(hall.Id);
        Assert.Equal(HallStatus.Rejected, adminDetail.Status);

        var pending = await CreateAdminReviewService(admin.Id).GetPendingHallsAsync(1, 10);
        Assert.DoesNotContain(pending.Items, item => item.HallId == hall.Id);

        var rejected = await CreateAdminReviewService(admin.Id).GetRejectedHallsAsync(1, 10);
        var row = Assert.Single(rejected.Items, item => item.HallId == hall.Id);
        Assert.Equal(hall.Name, row.Name);

        var listing = await new AllHallsService(new HallRepository(_context))
            .GetApprovedHallsAsync(1, 12);
        Assert.DoesNotContain(listing.Items, item => item.HallId == hall.Id);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            new HallDetailsService(new HallRepository(_context),
                new FakeCurrentUser(seeker.Id, true, ApplicationRoles.RegisteredUser), TestClock(),
                CreateSeekerService(seeker.Id), NullLogger<HallDetailsService>.Instance)
            .GetHallDetailsAsync(hall.Id));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateSeekerService(seeker.Id).CreateHourlyBookingAsync(new HourlyBookingRequestDto
            {
                HallId = hall.Id,
                Date = date,
                SlotStarts = [new TimeOnly(10, 0)],
                NameOnBooking = "Seeker",
                RequesterName = "Seeker"
            }));
    }

    [Fact]
    public async Task Admin_CanApprove_RejectedHall_WithFullVisibility()
    {
        var owner = await CreateUserAsync("o4@example.com", "+970599100007", ApplicationRoles.HallOwner);
        var seeker = await CreateUserAsync("s4@example.com", "+970599100008", ApplicationRoles.RegisteredUser);
        var admin = await CreateUserAsync("a4@example.com", "+970599100009", ApplicationRoles.Admin);
        var hall = AddHall(owner.Id, HallStatus.PendingReview);

        await CreateAdminReviewService(admin.Id).RejectHallAsync(
            hall.Id, new AdminRejectHallRequestDto { Reason = "Fix the cover photo." });

        var approval = await CreateAdminHallService(admin.Id).ApproveHallAsync(hall.Id);

        Assert.Equal(HallStatus.Approved, approval.Status);

        // Persisted, visible through the approved flows, payment untouched, no stale status.
        _context.ChangeTracker.Clear();
        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.Equal(HallStatus.Approved, reloaded!.Status);
        Assert.Equal(HallPaymentStatus.Paid, reloaded.PaymentStatus);

        var listing = await new AllHallsService(new HallRepository(_context))
            .GetApprovedHallsAsync(1, 12);
        Assert.Contains(listing.Items, item => item.HallId == hall.Id);

        var date = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);
        var booking = await CreateSeekerService(seeker.Id).CreateHourlyBookingAsync(
            new HourlyBookingRequestDto
            {
                HallId = hall.Id,
                Date = date,
                SlotStarts = [new TimeOnly(10, 0)],
                NameOnBooking = "Seeker",
                RequesterName = "Seeker"
            });
        Assert.Equal(hall.Id, booking.HallId);

        var ownerDetails = await CreateOwnerHallService(owner.Id).GetOwnedHallDetailsAsync(hall.Id);
        Assert.Equal(HallStatus.Approved, ownerDetails.Status);
    }

    [Fact]
    public async Task ApproveHall_NonApprovableStatus_StillRefused()
    {
        // Approval stays a strict lifecycle transition: with only PendingReview and
        // Rejected approvable, a deleted hall is still NotFound rather than approved.
        var admin = await CreateUserAsync("a5@example.com", "+970599100010", ApplicationRoles.Admin);
        var owner = await CreateUserAsync("o5@example.com", "+970599100011", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, HallStatus.Approved);
        hall.IsDeleted = true;
        await _context.SaveChangesAsync();
        _context.ChangeTracker.Clear();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateAdminHallService(admin.Id).ApproveHallAsync(hall.Id));
    }

    // ---------- Identity-document gating ----------

    [Fact]
    public async Task CreateHall_WithoutIdentityDocument_IsForbidden()
    {
        var owner = await CreateUserAsync("o6@example.com", "+970599100012", ApplicationRoles.HallOwner);

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            CreateCreationService(owner.Id).CreateHallAsync(ValidCreateRequest()));

        Assert.Contains("identity document", ex.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(_context.Halls);
    }

    [Fact]
    public async Task CreateHall_WithIdentityDocument_Succeeds()
    {
        var owner = await CreateUserAsync(
            "o7@example.com", "+970599100013", ApplicationRoles.HallOwner,
            identityDocumentUrl: "/documents/owners/owner-7/id.jpg");

        var result = await CreateCreationService(owner.Id).CreateHallAsync(ValidCreateRequest());

        Assert.Equal("Test Hall", result.Name);
        Assert.Equal(HallStatus.PendingReview, result.Status);
    }

    // ---------- Edit 27: obsolete payment-notice field is gone ----------

    [Fact]
    public void ObsoletePaymentReceiptFields_DoNotExist()
    {
        // Payment proof lives in conversation attachments; the old receipt columns must
        // not resurface on the hall or subscription contracts.
        Assert.Null(typeof(Hall).GetProperty("PaymentReceiptUrl"));
        Assert.Null(typeof(Hall).GetProperty("PaymentReceiptUploadedAt"));
        Assert.Null(typeof(AdminHallDetailDto).GetProperty("PaymentReceiptUrl"));
        Assert.Null(typeof(OwnerHallSubscriptionDto).GetProperty("PaymentReceiptUploadedAt"));
        Assert.Null(typeof(OwnerHallSubscriptionDto).GetProperty("HasPaymentReceipt"));
    }

    [Fact]
    public async Task PaymentProof_FlowsThrough_MessageAttachment()
    {
        var owner = await CreateUserAsync("o8@example.com", "+970599100014", ApplicationRoles.HallOwner);
        var admin = await CreateUserAsync("a8@example.com", "+970599100015", ApplicationRoles.Admin);
        var hall = AddHall(owner.Id, HallStatus.Approved);

        var conversation = new Conversation
        {
            HallId = hall.Id,
            SenderUserId = admin.Id,
            HallOwnerId = owner.Id
        };
        _context.Conversations.Add(conversation);
        await _context.SaveChangesAsync();

        var storage = new DocumentStorage(Options.Create(new DocumentStorageOptions { Directory = _documentsRoot }));
        var service = new ConversationService(
            new ConversationRepository(_context), new MessageRepository(_context),
            new FakeBookingRejectionService(), new NoOpBookingAcceptanceService(),
            new HallRepository(_context),
            new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner),
            new RecordingConversationNotifier(), storage);

        var sent = await service.SendAttachmentMessageAsync(
            conversation.Id,
            new MessageAttachmentUpload
            {
                FileName = "proof.jpg",
                ContentType = "image/jpeg",
                Content = JpegBytes
            },
            "Payment proof attached",
            "proof-request-1");

        Assert.False(sent.IsDuplicate);
        _context.ChangeTracker.Clear();
        var stored = await _context.Messages.FindAsync(sent.MessageId);
        Assert.NotNull(stored);
        Assert.True(stored!.HasAttachment);
        Assert.False(string.IsNullOrWhiteSpace(stored.AttachmentUrl));
        Assert.True(File.Exists(Path.Combine(
            storage.ConversationAttachmentsDirectory(conversation.Id),
            Path.GetFileName(stored.AttachmentUrl!))));
    }

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        private readonly string[] _roles;

        public FakeCurrentUser(string? userId, bool authenticated, params string[] roles)
        {
            UserId = userId;
            IsAuthenticated = authenticated;
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
    }

    private sealed class FakeHallSearchIndexer : IHallSearchIndexer
    {
        public Task IndexHallAsync(HallSearchIndexDto hall, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<bool> IsIndexedAsync(Guid hallId, CancellationToken cancellationToken = default)
            => Task.FromResult(true);

        public Task RetryPendingAsync(CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private sealed class FakeBookingRejectionService : IBookingRejectionService
    {
        public Task<RejectBookingResultDto> RejectBookingAsync(
            Guid hallId, Guid bookingId, RejectBookingRequestDto request, CancellationToken cancellationToken = default)
            => Task.FromResult(new RejectBookingResultDto());

        public Task<int> DeliverPendingRejectionNotificationsAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(0);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();

        try
        {
            if (Directory.Exists(_mediaRoot))
            {
                Directory.Delete(_mediaRoot, true);
            }
        }
        catch
        {
        }

        try
        {
            if (Directory.Exists(_documentsRoot))
            {
                Directory.Delete(_documentsRoot, true);
            }
        }
        catch
        {
        }
    }
}
