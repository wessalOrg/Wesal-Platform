using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Wesal.API.Infrastructure;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
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
/// Media regression safety (Edits 17/18/28/29) plus the admin "Message" action.
/// Hall images are stored API-relative (<c>/uploads/...</c>); the owner edit form
/// resolves them to absolute display URLs, so the backend must normalize them back
/// on write and fall back to the gallery when the stored cover is blank. Identity
/// documents live outside the static-file area and must stream when present and 404
/// (never 500) when absent.
/// </summary>
public class MediaAdminImagesAndIdentityShould : IDisposable
{
    private static readonly byte[] JpegBytes =
        [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01];

    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly string _documentsRoot;

    public MediaAdminImagesAndIdentityShould()
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
        _documentsRoot = Path.Combine(Path.GetTempPath(), "wesal-test-docs-" + Guid.NewGuid());
    }

    private async Task<ApplicationUser> CreateUserAsync(string email, string phone, string role)
    {
        var user = new ApplicationUser { FullName = "Test User", Email = email, UserName = email, PhoneNumber = phone };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded) throw new Exception(string.Join(",", result.Errors.Select(e => e.Description)));
        await _userManager.AddToRoleAsync(user, role);
        return user;
    }

    private Hall AddHall(
        string ownerId,
        string? cover = "/uploads/halls/cover.jpg",
        HallStatus status = HallStatus.PendingReview,
        bool adminLocked = false)
    {
        var hall = new Hall
        {
            Name = "Grand Hall",
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
            IsDeleted = false,
            IsAdminLocked = adminLocked,
            MainImageUrl = cover,
            HourlySlotStart = new TimeOnly(9, 0),
            HourlySlotEnd = new TimeOnly(21, 0),
            ShowBookedSlots = true
        };
        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    private HallImage AddImage(Guid hallId, string url, int order = 0)
    {
        var image = new HallImage { HallId = hallId, Url = url, DisplayOrder = order, IsDeleted = false };
        _context.HallImages.Add(image);
        _context.SaveChanges();
        return image;
    }

    private DocumentStorage CreateDocumentStorage()
        => new(Options.Create(new DocumentStorageOptions { Directory = _documentsRoot }));

    private static FakeDateTime TestClock()
        => new(new DateTimeOffset(2026, 10, 1, 10, 0, 0, TimeSpan.Zero));

    private AdminHallReviewService CreateAdminService(string adminId, IDocumentStorage? storage = null)
        => new(new AdminDashboardRepository(_context), new HallRepository(_context),
            new UnitOfWork(_context), new ConversationRepository(_context),
            new MessageRepository(_context),
            new FakeCurrentUser(adminId, true, ApplicationRoles.Admin), TestClock(),
            new RecordingConversationNotifier(), _userManager, storage ?? CreateDocumentStorage(),
            new FakeNotificationService(), new RecordingNotificationDispatcher(),
            NullLogger<AdminHallReviewService>.Instance);

    private OwnerIdentityService CreateIdentityService(string userId, string role, IDocumentStorage? storage = null)
        => new(_userManager, new FakeCurrentUser(userId, true, role), storage ?? CreateDocumentStorage());

    private ConversationService CreateConversationService(string userId, string role, IDocumentStorage? storage = null)
        => new(new ConversationRepository(_context), new MessageRepository(_context),
            new FakeBookingRejectionService(), new NoOpBookingAcceptanceService(),
            new HallRepository(_context), new FakeCurrentUser(userId, true, role),
            new RecordingConversationNotifier(), new FakeAttachmentStorage());

    private OwnerHallService CreateOwnerHallService(string ownerId)
        => new(_userManager, new FakeCurrentUser(ownerId, true, ApplicationRoles.HallOwner),
            new OwnerDashboardRepository(_context), new BookingRepository(_context),
            new UnitOfWork(_context));

    private static OwnerDocumentUpload JpegUpload(string fileName = "id.jpg") => new()
    {
        FileName = fileName,
        ContentType = "image/jpeg",
        Content = JpegBytes
    };

    private static UpdateOwnerHallRequest DetailsRequest(Hall hall, string? cover, params UpdateOwnerHallPhotoDto[] photos) => new()
    {
        Name = hall.Name,
        Address = hall.Address,
        Region = hall.Region,
        Capacity = hall.Capacity,
        Price = hall.Price,
        ShowPrice = hall.ShowPrice,
        ContactPhone = hall.ContactPhone,
        Description = hall.Description,
        MainImageUrl = cover,
        Photos = photos
    };

    // ---------- Edit 17: admin hall images ----------

    [Fact]
    public async Task AdminHallDetail_ReturnsCoverAndGalleryImages()
    {
        var owner = await CreateUserAsync("o1@example.com", "+970599100001", ApplicationRoles.HallOwner);
        var admin = await CreateUserAsync("a1@example.com", "+970599100002", ApplicationRoles.Admin);
        var hall = AddHall(owner.Id, cover: "/uploads/halls/cover.jpg");
        AddImage(hall.Id, "/uploads/halls/g1.jpg", order: 0);
        AddImage(hall.Id, "/uploads/halls/g2.jpg", order: 1);

        var detail = await CreateAdminService(admin.Id).GetAdminHallDetailAsync(hall.Id);

        Assert.Equal("/uploads/halls/cover.jpg", detail.MainImageUrl);
        Assert.Equal(
            ["/uploads/halls/g1.jpg", "/uploads/halls/g2.jpg"],
            detail.PhotoUrls.ToArray());
    }

    [Fact]
    public async Task AdminHallDetail_BlankCover_FallsBackToFirstGalleryPhoto()
    {
        var owner = await CreateUserAsync("o2@example.com", "+970599100003", ApplicationRoles.HallOwner);
        var admin = await CreateUserAsync("a2@example.com", "+970599100004", ApplicationRoles.Admin);
        var hall = AddHall(owner.Id, cover: null);
        AddImage(hall.Id, "/uploads/halls/g1.jpg", order: 1);
        AddImage(hall.Id, "/uploads/halls/g0.jpg", order: 0);

        var detail = await CreateAdminService(admin.Id).GetAdminHallDetailAsync(hall.Id);

        Assert.Equal("/uploads/halls/g0.jpg", detail.MainImageUrl);
    }

    [Fact]
    public async Task AdminPendingList_BlankCover_FallsBackToGalleryThumbnail()
    {
        var owner = await CreateUserAsync("o3@example.com", "+970599100005", ApplicationRoles.HallOwner);
        var admin = await CreateUserAsync("a3@example.com", "+970599100006", ApplicationRoles.Admin);
        var hall = AddHall(owner.Id, cover: null, status: HallStatus.PendingReview);
        AddImage(hall.Id, "/uploads/halls/g1.jpg");

        var page = await CreateAdminService(admin.Id).GetPendingHallsAsync(1, 10);

        var row = Assert.Single(page.Items, item => item.HallId == hall.Id);
        Assert.Equal("/uploads/halls/g1.jpg", row.ThumbnailUrl);
    }

    // ---------- Edits 18/29: public cover images ----------

    [Fact]
    public async Task PublicListing_BlankCover_ReturnsFirstGalleryPhoto()
    {
        var owner = await CreateUserAsync("o4@example.com", "+970599100007", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, cover: null, status: HallStatus.Approved);
        AddImage(hall.Id, "/uploads/halls/g1.jpg", order: 0);

        var page = await new AllHallsService(new HallRepository(_context))
            .GetApprovedHallsAsync(1, 12);

        var item = Assert.Single(page.Items, i => i.HallId == hall.Id);
        Assert.Equal("/uploads/halls/g1.jpg", item.MainImage);
    }

    [Fact]
    public async Task PublicSearch_BlankCover_ReturnsFirstGalleryPhoto()
    {
        var owner = await CreateUserAsync("o5@example.com", "+970599100008", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, cover: null, status: HallStatus.Approved);
        AddImage(hall.Id, "/uploads/halls/g1.jpg", order: 0);

        var page = await new HallSearchService(new HallRepository(_context))
            .SearchHallsAsync(new HallSearchRequest { PageNumber = 1, PageSize = 12 });

        var item = Assert.Single(page.Items, i => i.HallId == hall.Id);
        Assert.Equal("/uploads/halls/g1.jpg", item.MainImage);
    }

    [Fact]
    public async Task FeaturedHalls_BlankCover_ReturnsFirstGalleryPhoto()
    {
        var owner = await CreateUserAsync("o6@example.com", "+970599100009", ApplicationRoles.HallOwner);
        await CreateUserAsync("s6@example.com", "+970599100010", ApplicationRoles.RegisteredUser);
        var hall = AddHall(owner.Id, cover: null, status: HallStatus.Approved);
        AddImage(hall.Id, "/uploads/halls/g1.jpg", order: 0);

        var hallRepository = new HallRepository(_context);
        var bookingRepository = new BookingRepository(_context);
        var featured = await new FeaturedHallsService(
                hallRepository, TestClock(),
                new HourlySlotService(hallRepository, bookingRepository, new UnitOfWork(_context),
                    new FakeCurrentUser("seeker", true, ApplicationRoles.RegisteredUser),
                    new RecordingOwnerBookingRequestNotifier(), new RecordingNotificationDispatcher()),
                NullLogger<FeaturedHallsService>.Instance)
            .GetFeaturedHallsAsync(HallRegion.Gaza);

        var item = Assert.Single(featured, h => h.HallId == hall.Id);
        Assert.Equal("/uploads/halls/g1.jpg", item.MainImage);
    }

    [Fact]
    public async Task HallDetails_MissingImages_HandledSafelyWithNullCover()
    {
        var owner = await CreateUserAsync("o7@example.com", "+970599100011", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, cover: null, status: HallStatus.Approved);

        var hallRepository = new HallRepository(_context);
        var bookingRepository = new BookingRepository(_context);
        var details = await new HallDetailsService(
                hallRepository, new FakeCurrentUser("anon", false), TestClock(),
                new HourlySlotService(hallRepository, bookingRepository, new UnitOfWork(_context),
                    new FakeCurrentUser("anon", false),
                    new RecordingOwnerBookingRequestNotifier(), new RecordingNotificationDispatcher()),
                NullLogger<HallDetailsService>.Instance)
            .GetHallDetailsAsync(hall.Id);

        Assert.Null(details.MainImageUrl);
        Assert.Empty(details.Photos);
    }

    // ---------- Owner write path: normalization + cover invariant ----------

    [Fact]
    public async Task OwnerUpdate_AbsoluteMediaUrls_AreStoredRelative()
    {
        var owner = await CreateUserAsync("o8@example.com", "+970599100012", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, cover: "/uploads/halls/old.jpg", status: HallStatus.Approved);

        await CreateOwnerHallService(owner.Id).UpdateOwnedHallAsync(hall.Id, DetailsRequest(
            hall,
            "https://api-prod.example.com/uploads/halls/cover.jpg",
            new UpdateOwnerHallPhotoDto { Url = "https://api-prod.example.com/uploads/halls/g1.jpg", DisplayOrder = 0 }));

        _context.ChangeTracker.Clear();
        var reloaded = await _context.Halls
            .Include(h => h.Images)
            .FirstAsync(h => h.Id == hall.Id);

        Assert.Equal("/uploads/halls/cover.jpg", reloaded.MainImageUrl);
        var gallery = Assert.Single(reloaded.Images, i => !i.IsDeleted);
        Assert.Equal("/uploads/halls/g1.jpg", gallery.Url);
    }

    [Fact]
    public async Task OwnerUpdate_BlankCoverWithPhotos_DefaultsToFirstGalleryPhoto()
    {
        var owner = await CreateUserAsync("o9@example.com", "+970599100013", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, cover: "/uploads/halls/old.jpg", status: HallStatus.Approved);

        await CreateOwnerHallService(owner.Id).UpdateOwnedHallAsync(hall.Id, DetailsRequest(
            hall,
            cover: null,
            new UpdateOwnerHallPhotoDto { Url = "/uploads/halls/g1.jpg", DisplayOrder = 0 }));

        _context.ChangeTracker.Clear();
        var reloaded = await _context.Halls.FirstAsync(h => h.Id == hall.Id);

        Assert.Equal("/uploads/halls/g1.jpg", reloaded.MainImageUrl);
    }

    // ---------- Edits 17/28: identity document ----------

    [Fact]
    public async Task IdentityDocument_UploadThenAdminPreview_ReturnsExistingFile()
    {
        var storage = CreateDocumentStorage();
        var owner = await CreateUserAsync("o10@example.com", "+970599100014", ApplicationRoles.HallOwner);
        var admin = await CreateUserAsync("a10@example.com", "+970599100015", ApplicationRoles.Admin);

        await CreateIdentityService(owner.Id, ApplicationRoles.HallOwner, storage)
            .UploadIdentityDocumentAsync(JpegUpload());

        var document = await CreateAdminService(admin.Id, storage)
            .GetOwnerIdentityDocumentAsync(owner.Id);

        Assert.True(File.Exists(document.FullPath));
        Assert.Equal("image/jpeg", document.ContentType);

        var response = await StoredDocumentResult.ServeAsync(
            document.FullPath, document.ContentType, CancellationToken.None);
        var file = Assert.IsType<FileContentResult>(response);
        Assert.Equal(JpegBytes, file.FileContents);
        Assert.Equal("image/jpeg", file.ContentType);
    }

    [Fact]
    public async Task IdentityDocument_MissingUpload_ReturnsNotFound()
    {
        var storage = CreateDocumentStorage();
        var owner = await CreateUserAsync("o11@example.com", "+970599100016", ApplicationRoles.HallOwner);
        var admin = await CreateUserAsync("a11@example.com", "+970599100017", ApplicationRoles.Admin);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateAdminService(admin.Id, storage).GetOwnerIdentityDocumentAsync(owner.Id));
    }

    [Fact]
    public async Task IdentityDocument_DeletedFile_ReturnsNotFound()
    {
        var storage = CreateDocumentStorage();
        var owner = await CreateUserAsync("o12@example.com", "+970599100018", ApplicationRoles.HallOwner);
        var admin = await CreateUserAsync("a12@example.com", "+970599100019", ApplicationRoles.Admin);

        await CreateIdentityService(owner.Id, ApplicationRoles.HallOwner, storage)
            .UploadIdentityDocumentAsync(JpegUpload());
        var document = await CreateAdminService(admin.Id, storage)
            .GetOwnerIdentityDocumentAsync(owner.Id);

        File.Delete(document.FullPath);
        _context.ChangeTracker.Clear();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateAdminService(admin.Id, storage).GetOwnerIdentityDocumentAsync(owner.Id));

        // The serve layer maps a file that vanished after the check to 404 as well,
        // never an unrelated storage exception.
        await Assert.ThrowsAsync<NotFoundException>(() =>
            StoredDocumentResult.ServeAsync(document.FullPath, document.ContentType, CancellationToken.None));
    }

    [Fact]
    public async Task IdentityDocument_AnotherUserCannotAccessPrivateDocument()
    {
        var storage = CreateDocumentStorage();
        var owner = await CreateUserAsync("o13@example.com", "+970599100020", ApplicationRoles.HallOwner);
        var other = await CreateUserAsync("o14@example.com", "+970599100021", ApplicationRoles.HallOwner);

        await CreateIdentityService(owner.Id, ApplicationRoles.HallOwner, storage)
            .UploadIdentityDocumentAsync(JpegUpload());

        // The other owner resolves only their own (absent) document: never the victim's.
        var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateIdentityService(other.Id, ApplicationRoles.HallOwner, storage)
                .GetIdentityDocumentAsync());
        Assert.DoesNotContain(owner.Id, ex.Message, StringComparison.Ordinal);

        var refreshed = await _userManager.FindByIdAsync(owner.Id);
        Assert.True(File.Exists(
            Wesal.Infrastructure.Documents.DocumentPath.ResolveFullPath(
                storage.Root, refreshed!.IdentityDocumentUrl!)));
    }

    // ---------- Admin "Message" action ----------

    [Fact]
    public async Task AdminMessageAction_OpensThenReusesOwnerThread()
    {
        var owner = await CreateUserAsync("o15@example.com", "+970599100022", ApplicationRoles.HallOwner);
        var admin = await CreateUserAsync("a15@example.com", "+970599100023", ApplicationRoles.Admin);
        var hall = AddHall(owner.Id);

        var service = CreateAdminService(admin.Id);

        var first = await service.GetOwnerConversationAsync(hall.Id);
        Assert.False(first.IsExisting);
        Assert.Equal(hall.Id, first.HallId);
        Assert.Equal(owner.Id, first.OwnerUserId);

        var second = await service.GetOwnerConversationAsync(hall.Id);
        Assert.True(second.IsExisting);
        Assert.Equal(first.ConversationId, second.ConversationId);
    }

    [Fact]
    public async Task AdminMessageAction_ReusesOwnerInitiatedThread()
    {
        var owner = await CreateUserAsync("o16@example.com", "+970599100024", ApplicationRoles.HallOwner);
        var admin = await CreateUserAsync("a16@example.com", "+970599100025", ApplicationRoles.Admin);
        var hall = AddHall(owner.Id);

        // The owner opens their support thread first through the existing infrastructure.
        var ownerThread = await CreateConversationService(owner.Id, ApplicationRoles.HallOwner)
            .ContactAdminAsync(hall.Id);

        var adminThread = await CreateAdminService(admin.Id).GetOwnerConversationAsync(hall.Id);

        Assert.True(adminThread.IsExisting);
        Assert.Equal(ownerThread.ConversationId, adminThread.ConversationId);
    }

    [Fact]
    public async Task AdminMessageAction_WorksOnLockedHall()
    {
        var owner = await CreateUserAsync("o17@example.com", "+970599100026", ApplicationRoles.HallOwner);
        var admin = await CreateUserAsync("a17@example.com", "+970599100027", ApplicationRoles.Admin);
        var hall = AddHall(owner.Id, adminLocked: true);

        var thread = await CreateAdminService(admin.Id).GetOwnerConversationAsync(hall.Id);

        Assert.Equal(hall.Id, thread.HallId);
        Assert.Equal(owner.Id, thread.OwnerUserId);
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

    private sealed class FakeBookingRejectionService : IBookingRejectionService
    {
        public Task<RejectBookingResultDto> RejectBookingAsync(
            Guid hallId, Guid bookingId, RejectBookingRequestDto request, CancellationToken cancellationToken = default)
            => Task.FromResult(new RejectBookingResultDto());

        public Task<int> DeliverPendingRejectionNotificationsAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(0);
    }

    private sealed class FakeAttachmentStorage : IDocumentStorage
    {
        public string Root => Path.Combine(Path.GetTempPath(), "wesal-test-attachments");

        public string OwnerDocumentsDirectory(string ownerId)
            => Path.Combine(Root, "documents", "owners", ownerId);

        public string ConversationAttachmentsDirectory(Guid conversationId)
            => Path.Combine(Root, "documents", "conversations", conversationId.ToString(), "attachments");
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();

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
