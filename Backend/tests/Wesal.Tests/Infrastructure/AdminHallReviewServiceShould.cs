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

namespace Wesal.Tests.Infrastructure;

public class AdminHallReviewServiceShould : IDisposable
{
    private static readonly DateOnly Today = DateOnly.FromDateTime(new DateTime(2026, 8, 15));

    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public AdminHallReviewServiceShould()
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

    private async Task<ApplicationUser> CreateOwnerAsync(string email, string phone)
    {
        var user = new ApplicationUser { FullName = "Hall Owner", Email = email, UserName = email, PhoneNumber = phone };
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

    private Hall AddHall(string ownerId, string name, HallStatus status, bool withPhotos = false)
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
        if (withPhotos)
        {
            hall.Images.Add(new HallImage { HallId = hall.Id, Url = "https://cdn.example.com/1.jpg", DisplayOrder = 0 });
            hall.Images.Add(new HallImage { HallId = hall.Id, Url = "https://cdn.example.com/2.jpg", DisplayOrder = 1 });
        }
        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    private AdminHallReviewService CreateService(ICurrentUserService currentUser, IDateTime? dateTime = null)
        => new(
            new AdminDashboardRepository(_context),
            new HallRepository(_context),
            new UnitOfWork(_context),
            new ConversationRepository(_context),
            new MessageRepository(_context),
            currentUser,
            dateTime ?? new FakeDateTime(new DateTimeOffset(2026, 8, 15, 10, 0, 0, TimeSpan.Zero)),
            new FakeNotifier(),
            _userManager,
            new FakeDocumentStorage(),
            NullLogger<AdminHallReviewService>.Instance);

    private sealed class FakeDocumentStorage : IDocumentStorage
    {
        public string Root => Path.Combine(Path.GetTempPath(), "wesal-test-documents");

        public string OwnerDocumentsDirectory(string ownerId) => Path.Combine(Root, "documents", "owners", ownerId);

    
        public string ConversationAttachmentsDirectory(Guid conversationId) => Path.Combine(Root, "documents", "conversations", conversationId.ToString(), "attachments");
    }

    // --- US-ADMIN-01: Pending queue ---

    [Fact]
    public async Task GetPendingHalls_OnlyReturnsPendingAndNonDeleted()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        AddHall(owner.Id, "Pending", HallStatus.PendingReview);
        AddHall(owner.Id, "Approved", HallStatus.Approved);
        AddHall(owner.Id, "Rejected", HallStatus.Rejected);
        var deleted = AddHall(owner.Id, "Deleted Pending", HallStatus.PendingReview);
        deleted.IsDeleted = true;
        _context.SaveChanges();

        var result = await CreateService(new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin))
            .GetPendingHallsAsync(1, 10);

        Assert.Single(result.Items);
        Assert.Equal("Pending", result.Items[0].Name);
        Assert.Equal(1, result.TotalCount);
    }

    [Fact]
    public async Task GetPendingHalls_Pagination_ReturnsCorrectPage()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        for (var i = 0; i < 5; i++)
            AddHall(owner.Id, $"Hall {i}", HallStatus.PendingReview);

        var page1 = await CreateService(new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin))
            .GetPendingHallsAsync(1, 2);
        var page2 = await CreateService(new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin))
            .GetPendingHallsAsync(2, 2);

        Assert.Equal(2, page1.Items.Count);
        Assert.Equal(2, page2.Items.Count);
        Assert.Equal(5, page1.TotalCount);
        Assert.False(page1.Items.Select(x => x.HallId).Intersect(page2.Items.Select(x => x.HallId)).Any());
    }

    [Fact]
    public async Task GetPendingHalls_OrderedOldestFirst()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var early = AddHall(owner.Id, "Early", HallStatus.PendingReview);
        early.CreatedAt = new DateTimeOffset(2026, 8, 1, 0, 0, 0, TimeSpan.Zero);
        var late = AddHall(owner.Id, "Late", HallStatus.PendingReview);
        late.CreatedAt = new DateTimeOffset(2026, 8, 10, 0, 0, 0, TimeSpan.Zero);
        _context.SaveChanges();

        var result = await CreateService(new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin))
            .GetPendingHallsAsync(1, 10);

        Assert.Equal("Early", result.Items[0].Name);
        Assert.Equal("Late", result.Items[1].Name);
    }

    // --- US-ADMIN-01: Hall detail ---

    [Fact]
    public async Task GetAdminHallDetail_ReturnsOwnerInfoAndPhotos()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.PendingReview, withPhotos: true);

        var result = await CreateService(new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin))
            .GetAdminHallDetailAsync(hall.Id);

        Assert.Equal("Grand Hall", result.Name);
        Assert.Equal("Hall Owner", result.OwnerFullName);
        Assert.Equal("+970599100001", result.OwnerPhoneNumber);
        Assert.Equal("owner@example.com", result.OwnerEmail);
        Assert.Equal(2, result.PhotoUrls.Count);
        Assert.Contains("https://cdn.example.com/1.jpg", result.PhotoUrls);
    }

    [Fact]
    public async Task GetAdminHallDetail_DeletedHall_ThrowsNotFound()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddHall(owner.Id, "Deleted Hall", HallStatus.PendingReview);
        hall.IsDeleted = true;
        _context.SaveChanges();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateService(new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin))
                .GetAdminHallDetailAsync(hall.Id));
    }

    [Fact]
    public async Task GetAdminHallDetail_NonExistent_ThrowsNotFound()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateService(new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin))
                .GetAdminHallDetailAsync(Guid.NewGuid()));
    }

    // --- US-ADMIN-03: Rejection ---

    [Fact]
    public async Task RejectHall_PendingReview_SetsRejectedAndDeliversNotification()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var admin = await CreateAdminAsync("admin@example.com");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.PendingReview);

        var result = await CreateService(new FakeCurrentUser(admin.Id, true, ApplicationRoles.Admin))
            .RejectHallAsync(hall.Id, new AdminRejectHallRequestDto { Reason = "Incomplete" });

        Assert.False(result.IsAlreadyRejected);
        Assert.True(result.NotificationDelivered);
        Assert.Equal(HallStatus.Rejected, result.Status);

        var message = await _context.Messages
            .Include(m => m.Conversation)
            .FirstOrDefaultAsync(m => m.SenderUserId == admin.Id && (m.Content ?? string.Empty).Contains("Incomplete"));
        Assert.NotNull(message);
        Assert.Equal(owner.Id.ToString(), message!.Conversation.HallOwnerId);
        Assert.Equal(hall.Id, message.Conversation.HallId);
    }

    [Fact]
    public async Task RejectHall_AlreadyRejected_Idempotent()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddHall(owner.Id, "Rejected Hall", HallStatus.Rejected);

        var result = await CreateService(new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin))
            .RejectHallAsync(hall.Id, new AdminRejectHallRequestDto());

        Assert.True(result.IsAlreadyRejected);
        Assert.False(result.NotificationDelivered);
    }

    [Fact]
    public async Task RejectHall_ApprovedWithoutConfirm_ThrowsConflict()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddHall(owner.Id, "Live Hall", HallStatus.Approved);

        await Assert.ThrowsAsync<ConflictException>(() =>
            CreateService(new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin))
                .RejectHallAsync(hall.Id, new AdminRejectHallRequestDto()));
    }

    [Fact]
    public async Task RejectHall_ApprovedWithConfirm_RejectsAndDelivers()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var admin = await CreateAdminAsync("admin@example.com");
        var hall = AddHall(owner.Id, "Live Hall", HallStatus.Approved);

        var result = await CreateService(new FakeCurrentUser(admin.Id, true, ApplicationRoles.Admin))
            .RejectHallAsync(hall.Id, new AdminRejectHallRequestDto { ConfirmLiveApproved = true, Reason = "Policy violation" });

        Assert.Equal(HallStatus.Rejected, result.Status);
        Assert.True(result.NotificationDelivered);

        var message = await _context.Messages.FirstOrDefaultAsync(m => m.SenderUserId == admin.Id && (m.Content ?? string.Empty).Contains("Policy violation"));
        Assert.NotNull(message);
    }

    [Fact]
    public async Task RejectHall_NonExistent_ThrowsNotFound()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateService(new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin))
                .RejectHallAsync(Guid.NewGuid(), new AdminRejectHallRequestDto()));
    }

    // --- US-ADMIN-05: Manual lock ---

    [Fact]
    public async Task LockHall_ApprovedHall_SetsAdminLockFields()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var admin = await CreateAdminAsync("admin@example.com");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.Approved);

        var result = await CreateService(new FakeCurrentUser(admin.Id, true, ApplicationRoles.Admin))
            .LockHallAsync(hall.Id);

        Assert.True(result.IsLocked);
        Assert.Equal(admin.Id, result.LockedByAdminUserId);
        Assert.NotNull(result.LockedAt);
    }

    [Fact]
    public async Task LockHall_AlreadyLocked_Idempotent()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.Approved);
        hall.IsAdminLocked = true;
        hall.LockedByAdminUserId = "admin-1";
        hall.LockedAt = new DateTimeOffset(2026, 8, 1, 0, 0, 0, TimeSpan.Zero);
        _context.SaveChanges();

        var result = await CreateService(new FakeCurrentUser("admin-2", true, ApplicationRoles.Admin))
            .LockHallAsync(hall.Id);

        Assert.True(result.IsLocked);
        Assert.Equal("admin-1", result.LockedByAdminUserId);
    }

    [Fact]
    public async Task LockHall_DoesNotAlterPaymentStatusOrSystemLocked()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.Approved);
        hall.PaymentStatus = HallPaymentStatus.Paid;
        hall.SystemLocked = false;
        _context.SaveChanges();

        await CreateService(new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin))
            .LockHallAsync(hall.Id);

        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.Equal(HallPaymentStatus.Paid, reloaded!.PaymentStatus);
        Assert.False(reloaded.SystemLocked);
        Assert.True(reloaded.IsAdminLocked);
    }

    [Fact]
    public async Task LockHall_NonExistent_ThrowsNotFound()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateService(new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin))
                .LockHallAsync(Guid.NewGuid()));
    }

    // --- US-ADMIN-06: manual unlock ---

    [Fact]
    public async Task UnlockHall_ClearsOnlyAdminLock_AndRecordsAudit()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var admin = await CreateAdminAsync("admin@example.com");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.Approved);
        hall.IsAdminLocked = true;
        hall.LockedByAdminUserId = "admin-before";
        hall.LockedAt = new DateTimeOffset(2026, 8, 1, 0, 0, 0, TimeSpan.Zero);
        hall.PaymentStatus = HallPaymentStatus.Paid;
        hall.SystemLocked = false;
        hall.SubscriptionCycleStart = Today;
        hall.SubscriptionCycleEnd = Today.AddDays(30);
        _context.SaveChanges();

        var result = await CreateService(new FakeCurrentUser(admin.Id, true, ApplicationRoles.Admin))
            .UnlockHallAsync(hall.Id);

        Assert.False(result.IsLocked);
        Assert.Equal(admin.Id, result.UnlockedByAdminUserId);
        Assert.NotNull(result.UnlockedAt);
        Assert.True(result.ManagementAccessRestored);

        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.False(reloaded!.IsAdminLocked);
        Assert.False(reloaded.SystemLocked);
        Assert.Equal(HallPaymentStatus.Paid, reloaded.PaymentStatus);
        Assert.Equal(admin.Id, reloaded.UnlockedByAdminUserId);
        Assert.NotNull(reloaded.UnlockedAt);
        Assert.NotNull(reloaded.LockedByAdminUserId);
    }

    [Fact]
    public async Task UnlockHall_UnpaidStillSystemLocked_ReportsNotRestored()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.Approved);
        hall.IsAdminLocked = true;
        hall.LockedByAdminUserId = "admin-1";
        hall.LockedAt = new DateTimeOffset(2026, 8, 1, 0, 0, 0, TimeSpan.Zero);
        hall.PaymentStatus = HallPaymentStatus.Unpaid;
        hall.SystemLocked = true;
        _context.SaveChanges();

        var result = await CreateService(new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin))
            .UnlockHallAsync(hall.Id);

        Assert.False(result.IsLocked);
        Assert.False(result.ManagementAccessRestored);

        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.False(reloaded!.IsAdminLocked);
        Assert.True(reloaded.SystemLocked);
        Assert.Equal(HallPaymentStatus.Unpaid, reloaded.PaymentStatus);
    }

    [Fact]
    public async Task UnlockHall_CorrectsStaleSystemLock_AfterPaymentRaced()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.Approved);
        hall.IsAdminLocked = true;
        hall.LockedByAdminUserId = "admin-1";
        hall.LockedAt = new DateTimeOffset(2026, 8, 1, 0, 0, 0, TimeSpan.Zero);
        hall.PaymentStatus = HallPaymentStatus.Paid;
        hall.SystemLocked = true;
        hall.SubscriptionCycleStart = Today;
        hall.SubscriptionCycleEnd = Today.AddDays(30);
        _context.SaveChanges();

        var result = await CreateService(new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin))
            .UnlockHallAsync(hall.Id);

        Assert.False(result.IsLocked);
        Assert.True(result.ManagementAccessRestored);

        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.False(reloaded!.IsAdminLocked);
        Assert.False(reloaded.SystemLocked);
    }

    [Fact]
    public async Task UnlockHall_NotLocked_IsNoOp()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.Approved);

        var result = await CreateService(new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin))
            .UnlockHallAsync(hall.Id);

        Assert.False(result.IsLocked);
        Assert.Null(result.UnlockedAt);
        Assert.Null(result.UnlockedByAdminUserId);
    }

    [Fact]
    public async Task UnlockHall_NonExistent_ThrowsNotFound()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateService(new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin))
                .UnlockHallAsync(Guid.NewGuid()));
    }

    // --- US-ADMIN-04: direct Admin-to-Owner messaging ---

    [Fact]
    public async Task SendMessageToOwner_PersistsMessage_AndReturnsSent()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.PendingReview);

        var result = await CreateService(new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin))
            .SendMessageToOwnerAsync(hall.Id, "Please add the missing photos.");

        Assert.False(result.OwnerBlocked);
        Assert.False(result.DeliveryPending);
        Assert.Equal(hall.Id, result.HallId);
        Assert.Equal("Please add the missing photos.", result.Content);

        var message = await _context.Messages.FindAsync(result.MessageId);
        Assert.NotNull(message);
        Assert.Equal("admin-1", message!.SenderUserId);
        Assert.Equal("Please add the missing photos.", message.Content);

        var conversation = await _context.Conversations.FindAsync(result.ConversationId);
        Assert.Equal(owner.Id, conversation!.HallOwnerId);
    }

    [Fact]
    public async Task SendMessageToOwner_ReusesExistingConversation()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.PendingReview);

        var service = CreateService(new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin));
        var first = await service.SendMessageToOwnerAsync(hall.Id, "First message.");
        var second = await service.SendMessageToOwnerAsync(hall.Id, "Second message.");

        Assert.Equal(first.ConversationId, second.ConversationId);
        var all = await _context.Messages
            .Where(m => m.ConversationId == first.ConversationId)
            .ToListAsync();
        Assert.Equal(2, all.Count);
    }

    // --- WESAL-TASK-4 (Edit 4): the owner/Admin thread is keyed by (HallId, HallOwnerId),
    // not by whichever Admin happens to be acting, so two different Admins must always
    // land in one single thread. ---

    [Fact]
    public async Task SendMessageToOwner_TwoDifferentAdmins_ShareOneThread()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var firstAdmin = await CreateAdminAsync("admin-a@example.com");
        var secondAdmin = await CreateAdminAsync("admin-b@example.com");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.PendingReview);

        var fromFirst = await CreateService(new FakeCurrentUser(firstAdmin.Id, true, ApplicationRoles.Admin))
            .SendMessageToOwnerAsync(hall.Id, "From the first admin.");
        var fromSecond = await CreateService(new FakeCurrentUser(secondAdmin.Id, true, ApplicationRoles.Admin))
            .SendMessageToOwnerAsync(hall.Id, "From the second admin.");

        Assert.Equal(fromFirst.ConversationId, fromSecond.ConversationId);

        // Exactly one owner/Admin thread exists for this hall+owner pair.
        var conversations = await _context.Conversations
            .Where(c => c.HallId == hall.Id && c.HallOwnerId == owner.Id)
            .ToListAsync();
        Assert.Single(conversations);
    }

    [Fact]
    public async Task SendMessageToOwner_TwoAdmins_ThenOwnerReply_AllInSameThread()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var firstAdmin = await CreateAdminAsync("admin-a@example.com");
        var secondAdmin = await CreateAdminAsync("admin-b@example.com");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.Approved);

        var fromFirst = await CreateService(new FakeCurrentUser(firstAdmin.Id, true, ApplicationRoles.Admin))
            .SendMessageToOwnerAsync(hall.Id, "First admin message.");
        var fromSecond = await CreateService(new FakeCurrentUser(secondAdmin.Id, true, ApplicationRoles.Admin))
            .SendMessageToOwnerAsync(hall.Id, "Second admin message.");

        // The owner's payment-proof reply must land in that same thread, so the Admin sees
        // the proof alongside their own messages.
        var conversation = await _context.Conversations.FindAsync(fromFirst.ConversationId);
        _context.Messages.Add(new Message
        {
            ConversationId = conversation!.Id,
            SenderUserId = owner.Id,
            Content = string.Empty,
            AttachmentUrl = "/documents/conversations/" + conversation.Id + "/attachments/proof.png",
            AttachmentContentType = "image/png",
            AttachmentFileName = "proof.png"
        });
        await _context.SaveChangesAsync();

        var senders = await _context.Messages
            .Where(m => m.ConversationId == fromFirst.ConversationId)
            .Select(m => m.SenderUserId)
            .ToListAsync();
        Assert.Equal(3, senders.Count);
        Assert.Contains(firstAdmin.Id, senders);
        Assert.Contains(secondAdmin.Id, senders);
        Assert.Contains(owner.Id, senders);
        Assert.Equal(fromSecond.ConversationId, fromFirst.ConversationId);
    }

    [Fact]
    public async Task SendMessageToOwner_ExistingDuplicateThreads_ReusesTheOldestDeterministically()
    {
        // Production already contains duplicate owner/Admin threads from the old
        // per-Admin keying. The lookup must deterministically pick the oldest row rather
        // than whichever row the database happens to return first.
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.Approved);
        var clock = new FakeDateTime(new DateTimeOffset(2026, 3, 1, 0, 0, 0, TimeSpan.Zero));
        var repository = new ConversationRepository(_context);

        // Seed the pre-existing older thread, then a newer duplicate of it.
        _context.Conversations.Add(new Conversation
        {
            HallId = hall.Id,
            HallOwnerId = owner.Id,
            SenderUserId = "admin-older",
            CreatedAt = clock.Now
        });
        await _context.SaveChangesAsync();
        var older = await repository.GetByHallForOwnerAsync(hall.Id, owner.Id);

        _context.Conversations.Add(new Conversation
        {
            HallId = hall.Id,
            HallOwnerId = owner.Id,
            SenderUserId = "admin-later",
            CreatedAt = clock.Now.AddDays(5)
        });
        await _context.SaveChangesAsync();

        var result = await CreateService(new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin), clock)
            .SendMessageToOwnerAsync(hall.Id, "Should reuse the oldest thread.");

        // No new thread was created and the message joined the pre-existing (oldest) one.
        Assert.NotNull(older);
        Assert.Equal(older!.Id, result.ConversationId);
        Assert.Equal(2, await _context.Conversations.CountAsync(c => c.HallId == hall.Id));
    }

    [Fact]
    public async Task GetByHallForOwnerAsync_TieOnCreatedAt_OrdersByIdSoLookupIsStable()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.Approved);
        var clock = new FakeDateTime(new DateTimeOffset(2026, 3, 1, 0, 0, 0, TimeSpan.Zero));
        var repository = new ConversationRepository(_context);

        // Two threads share the same CreatedAt: the Id tiebreaker must make the result
        // stable across repeated calls instead of depending on storage order.
        _context.Conversations.Add(new Conversation { HallId = hall.Id, HallOwnerId = owner.Id, SenderUserId = "admin-1", CreatedAt = clock.Now });
        await _context.SaveChangesAsync();
        _context.Conversations.Add(new Conversation { HallId = hall.Id, HallOwnerId = owner.Id, SenderUserId = "admin-2", CreatedAt = clock.Now });
        await _context.SaveChangesAsync();

        var first = await repository.GetByHallForOwnerAsync(hall.Id, owner.Id);
        var second = await repository.GetByHallForOwnerAsync(hall.Id, owner.Id);

        Assert.NotNull(first);
        Assert.Equal(first!.Id, second!.Id);
    }

    [Fact]
    public async Task GetByHallForOwnerAsync_DifferentOwner_SameHall_ReturnsNull()
    {
        // The lookup is scoped by owner as well as hall, so a hall's thread is never
        // handed to a different owner.
        var firstOwner = await CreateOwnerAsync("first@example.com", "+970599100001");
        var secondOwner = await CreateOwnerAsync("second@example.com", "+970599100002");
        var hall = AddHall(firstOwner.Id, "Grand Hall", HallStatus.Approved);
        _context.Conversations.Add(new Conversation { HallId = hall.Id, HallOwnerId = firstOwner.Id, SenderUserId = "admin-1" });
        await _context.SaveChangesAsync();

        var repository = new ConversationRepository(_context);

        Assert.Null(await repository.GetByHallForOwnerAsync(hall.Id, secondOwner.Id));
    }

    [Fact]
    public async Task SendMessageToOwner_BlockedOwner_QueuesMessageAndFlagsPending()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        await _userManager.SetLockoutEndDateAsync(owner, DateTimeOffset.UtcNow.AddHours(1));

        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.PendingReview);

        var result = await CreateService(new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin))
            .SendMessageToOwnerAsync(hall.Id, "Your account is currently locked.");

        Assert.True(result.OwnerBlocked);
        Assert.True(result.DeliveryPending);

        var message = await _context.Messages.FindAsync(result.MessageId);
        Assert.NotNull(message);
    }

    [Fact]
    public async Task SendMessageToOwner_MissingContent_ThrowsValidation()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.PendingReview);

        await Assert.ThrowsAsync<ValidationException>(() =>
            CreateService(new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin))
                .SendMessageToOwnerAsync(hall.Id, "   "));
    }

    [Fact]
    public async Task SendMessageToOwner_NonExistentHall_ThrowsNotFound()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateService(new FakeCurrentUser("admin-1", true, ApplicationRoles.Admin))
                .SendMessageToOwnerAsync(Guid.NewGuid(), "Hello"));
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
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
        public FakeDateTime(DateTimeOffset now) { Now = now; }
        public DateTimeOffset Now { get; }
    }

    private sealed class FakeNotifier : IConversationNotifier
    {
        public Task NotifyMessageSentAsync(MessageSentEvent message, CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }
    }
}