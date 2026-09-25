using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Bookings;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.OwnerDashboard;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

public class HallAccessGuardShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public HallAccessGuardShould()
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

    private async Task<ApplicationUser> CreateOwnerAsync(string email)
    {
        var user = new ApplicationUser { FullName = "Hall Owner", Email = email, UserName = email, PhoneNumber = "+970599100001" };
        await _userManager.CreateAsync(user, "Password123!");
        await _userManager.AddToRoleAsync(user, ApplicationRoles.HallOwner);
        return user;
    }

    private Hall AddHall(
        string ownerId,
        string name,
        HallStatus status = HallStatus.Approved,
        HallPaymentStatus payment = HallPaymentStatus.Paid,
        bool adminLocked = false,
        bool systemLocked = false)
    {
        var hall = new Hall
        {
            Name = name,
            Region = HallRegion.Gaza,
            Address = "Al-Rashid Street, Gaza",
            Capacity = 200,
            Price = 1500,
            ShowPrice = true,
            ContactPhone = "+970599111111",
            Description = "Spacious hall",
            OwnerId = ownerId,
            Status = status,
            PaymentStatus = payment,
            IsAdminLocked = adminLocked,
            SystemLocked = systemLocked
        };
        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    // --- Domain guard unit tests (US-ADMIN-05/07/09) ---

    [Fact]
    public void EnsureAllowed_AdminLocked_ThrowsHallLocked()
    {
        var hall = new Hall { Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, IsAdminLocked = true };
        var ex = Assert.Throws<BusinessRuleException>(() => HallManagementAccess.EnsureAllowed(hall));
        Assert.Equal(HallManagementAccess.HallLockedCode, ex.Code);
    }

    [Fact]
    public void EnsureAllowed_Unpaid_ThrowsPaymentRequired()
    {
        var hall = new Hall { Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Unpaid };
        var ex = Assert.Throws<BusinessRuleException>(() => HallManagementAccess.EnsureAllowed(hall));
        Assert.Equal(HallManagementAccess.PaymentRequiredCode, ex.Code);
    }

    [Fact]
    public void EnsureAllowed_SystemLocked_ThrowsHallSystemLocked()
    {
        var hall = new Hall { Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid, SystemLocked = true };
        var ex = Assert.Throws<BusinessRuleException>(() => HallManagementAccess.EnsureAllowed(hall));
        Assert.Equal(HallManagementAccess.HallSystemLockedCode, ex.Code);
    }

    [Fact]
    public void EnsureAllowed_AdminLocked_DominatesUnpaid_PaymentNotEvaluated()
    {
        var hall = new Hall { Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Unpaid, IsAdminLocked = true };
        var ex = Assert.Throws<BusinessRuleException>(() => HallManagementAccess.EnsureAllowed(hall));
        Assert.Equal(HallManagementAccess.HallLockedCode, ex.Code);
    }

    [Fact]
    public void EnsureAllowed_PaidOpenHall_DoesNotThrow()
    {
        var hall = new Hall { Status = HallStatus.Approved, PaymentStatus = HallPaymentStatus.Paid };
        HallManagementAccess.EnsureAllowed(hall);
    }

    [Fact]
    public void EnsureAcceptingBookings_AdminLocked_Throws()
    {
        var hall = new Hall { IsAdminLocked = true };
        var ex = Assert.Throws<BusinessRuleException>(() => HallManagementAccess.EnsureAcceptingBookings(hall));
        Assert.Equal(HallManagementAccess.HallLockedCode, ex.Code);
    }

    [Fact]
    public void EnsureAcceptingBookings_SystemLocked_Throws()
    {
        var hall = new Hall { SystemLocked = true };
        var ex = Assert.Throws<BusinessRuleException>(() => HallManagementAccess.EnsureAcceptingBookings(hall));
        Assert.Equal(HallManagementAccess.HallSystemLockedCode, ex.Code);
    }

    [Fact]
    public void EnsureAcceptingBookings_Unpaid_DoesNotThrow()
    {
        var hall = new Hall { PaymentStatus = HallPaymentStatus.Unpaid };
        HallManagementAccess.EnsureAcceptingBookings(hall);
    }

    // --- US-ADMIN-07: owner management blocked when unpaid ---

    [Fact]
    public async Task UpdateHall_ApprovedUnpaid_ThrowsPaymentRequired()
    {
        var owner = await CreateOwnerAsync("owner@example.com");
        var hall = AddHall(owner.Id, "Grand Hall", payment: HallPaymentStatus.Unpaid);
        var service = new OwnerHallService(
            _userManager,
            new FakeCurrentUser(owner.Id),
            new OwnerDashboardRepository(_context),
            new UnitOfWork(_context));

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            service.UpdateOwnedHallAsync(hall.Id, MinimalUpdateRequest()));
        Assert.Equal(HallManagementAccess.PaymentRequiredCode, ex.Code);
    }

    [Fact]
    public async Task UpdateHall_ApprovedAdminLocked_ThrowsHallLocked()
    {
        var owner = await CreateOwnerAsync("owner@example.com");
        var hall = AddHall(owner.Id, "Grand Hall", adminLocked: true);
        var service = new OwnerHallService(
            _userManager,
            new FakeCurrentUser(owner.Id),
            new OwnerDashboardRepository(_context),
            new UnitOfWork(_context));

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            service.UpdateOwnedHallAsync(hall.Id, MinimalUpdateRequest()));
        Assert.Equal(HallManagementAccess.HallLockedCode, ex.Code);
    }

    [Fact]
    public async Task UpdateHall_ApprovedSystemLocked_ThrowsHallSystemLocked()
    {
        var owner = await CreateOwnerAsync("owner@example.com");
        var hall = AddHall(owner.Id, "Grand Hall", systemLocked: true);
        var service = new OwnerHallService(
            _userManager,
            new FakeCurrentUser(owner.Id),
            new OwnerDashboardRepository(_context),
            new UnitOfWork(_context));

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            service.UpdateOwnedHallAsync(hall.Id, MinimalUpdateRequest()));
        Assert.Equal(HallManagementAccess.HallSystemLockedCode, ex.Code);
    }

    [Fact]
    public async Task UpdateHall_ApprovedPaid_Succeeds()
    {
        var owner = await CreateOwnerAsync("owner@example.com");
        var hall = AddHall(owner.Id, "Grand Hall", payment: HallPaymentStatus.Paid);
        var service = new OwnerHallService(
            _userManager,
            new FakeCurrentUser(owner.Id),
            new OwnerDashboardRepository(_context),
            new UnitOfWork(_context));

        var result = await service.UpdateOwnedHallAsync(hall.Id, MinimalUpdateRequest());

        Assert.Equal(hall.Id, result.HallId);
        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.Equal(HallStatus.Approved, reloaded!.Status);
    }

    // --- US-ADMIN-03 resubmission (Rejected+Paid edit re-queues PendingReview) ---

    [Fact]
    public async Task UpdateHall_RejectedPaid_ResubmitsToPendingReview()
    {
        var owner = await CreateOwnerAsync("owner@example.com");
        var hall = AddHall(owner.Id, "Rejected Hall", status: HallStatus.Rejected, payment: HallPaymentStatus.Paid);
        var service = new OwnerHallService(
            _userManager,
            new FakeCurrentUser(owner.Id),
            new OwnerDashboardRepository(_context),
            new UnitOfWork(_context));

        var result = await service.UpdateOwnedHallAsync(hall.Id, MinimalUpdateRequest());

        Assert.Equal(HallStatus.PendingReview, result.Status);
        // WESAL-TASK-2+3: re-queued to PendingReview, and still editable, because
        // approval status no longer gates the owner's edits.
        Assert.True(result.IsEditable);
        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.Equal(HallStatus.PendingReview, reloaded!.Status);
    }

    // --- US-ADMIN-05: seeker booking blocked on locked hall ---

    [Fact]
    public async Task CreateHourlyBooking_AdminLocked_ThrowsHallLocked()
    {
        var owner = await CreateOwnerAsync("owner@example.com");
        var hall = AddHall(owner.Id, "Grand Hall", adminLocked: true);
        var service = BuildHourlySlotService();

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            service.CreateHourlyBookingAsync(new HourlyBookingRequestDto
            {
                HallId = hall.Id,
                Date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
                SlotStarts = [new TimeOnly(10, 0)]
            }));
        Assert.Equal(HallManagementAccess.HallLockedCode, ex.Code);
    }

    [Fact]
    public async Task CreateHourlyBooking_SystemLocked_ThrowsHallSystemLocked()
    {
        var owner = await CreateOwnerAsync("owner@example.com");
        var hall = AddHall(owner.Id, "Grand Hall", systemLocked: true);
        var service = BuildHourlySlotService();

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            service.CreateHourlyBookingAsync(new HourlyBookingRequestDto
            {
                HallId = hall.Id,
                Date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
                SlotStarts = [new TimeOnly(10, 0)]
            }));
        Assert.Equal(HallManagementAccess.HallSystemLockedCode, ex.Code);
    }

    [Fact]
    public async Task CreateHourlyBooking_PaidOpenHall_Succeeds()
    {
        var owner = await CreateOwnerAsync("owner@example.com");
        var hall = AddHall(owner.Id, "Grand Hall");
        var service = BuildHourlySlotService();

        var result = await service.CreateHourlyBookingAsync(new HourlyBookingRequestDto
        {
            HallId = hall.Id,
            Date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            SlotStarts = [new TimeOnly(10, 0)]
        });

        Assert.Equal(hall.Id, result.HallId);
        Assert.Equal(BookingStatus.Pending, result.Status);
    }

    // --- US-ADMIN-05: owner calendar blocked on locked hall ---

    [Fact]
    public async Task SetDayBlock_AdminLocked_ThrowsHallLocked()
    {
        var owner = await CreateOwnerAsync("owner@example.com");
        var hall = AddHall(owner.Id, "Grand Hall", adminLocked: true);
        var service = new OwnerHourlyAvailabilityService(
            _userManager,
            new FakeCurrentUser(owner.Id),
            new OwnerDashboardRepository(_context),
            new BookingRepository(_context),
            new UnitOfWork(_context));

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            service.SetDayBlockAsync(hall.Id, new OwnerDayBlockRequest
            {
                Date = new DateOnly(2026, 9, 1),
                IsOpen = false
            }));
        Assert.Equal(HallManagementAccess.HallLockedCode, ex.Code);
    }

    // --- US-ADMIN-05/07: owner messaging blocked only on Approved halls ---

    [Fact]
    public async Task GetConversation_Owner_ApprovedUnpaid_ThrowsPaymentRequired()
    {
        var owner = await CreateOwnerAsync("owner@example.com");
        var hall = AddHall(owner.Id, "Grand Hall", payment: HallPaymentStatus.Unpaid);
        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            SenderUserId = "other-user",
            HallOwnerId = owner.Id,
            Hall = hall
        };

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            BuildMessagingService(conversation).GetConversationAsync(conversation.Id));
        Assert.Equal(HallManagementAccess.PaymentRequiredCode, ex.Code);
    }

    [Fact]
    public async Task GetConversation_Owner_ApprovedAdminLocked_ThrowsHallLocked()
    {
        var owner = await CreateOwnerAsync("owner@example.com");
        var hall = AddHall(owner.Id, "Grand Hall", adminLocked: true);
        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            SenderUserId = "other-user",
            HallOwnerId = owner.Id,
            Hall = hall
        };

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            BuildMessagingService(conversation).GetConversationAsync(conversation.Id));
        Assert.Equal(HallManagementAccess.HallLockedCode, ex.Code);
    }

    [Fact]
    public async Task GetConversation_Owner_RejectedUnpaid_AllowsAccess()
    {
        var owner = await CreateOwnerAsync("owner@example.com");
        var hall = AddHall(owner.Id, "Grand Hall", status: HallStatus.Rejected, payment: HallPaymentStatus.Unpaid);
        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            SenderUserId = "other-user",
            HallOwnerId = owner.Id,
            Hall = hall
        };

        var result = await BuildMessagingService(conversation).GetConversationAsync(conversation.Id);
        Assert.Equal(conversation.Id, result.ConversationId);
    }

    [Fact]
    public async Task SendMessage_Owner_RejectedUnpaid_AllowsMessage()
    {
        var owner = await CreateOwnerAsync("owner@example.com");
        var hall = AddHall(owner.Id, "Grand Hall", status: HallStatus.Rejected, payment: HallPaymentStatus.Unpaid);
        var conversation = new Conversation
        {
            Id = Guid.NewGuid(),
            HallId = hall.Id,
            SenderUserId = "other-user",
            HallOwnerId = owner.Id,
            Hall = hall
        };

        var result = await BuildMessagingService(conversation).SendMessageAsync(
            conversation.Id,
            new SendMessageRequest { Content = "Thanks for the update" });
        Assert.Equal("Thanks for the update", result.Content);
    }

    private ConversationService BuildMessagingService(Conversation conversation)
        => new(
            new FakeConversationRepository(conversation),
            new FakeMessageRepository(),
            new FakeBookingRejectionService(),
            new FakeHallRepository(),
            new FakeCurrentUser(conversation.HallOwnerId, [ApplicationRoles.HallOwner]),
            new FakeConversationNotifier(),
            new FakeDocumentStorage());

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }

    private static UpdateOwnerHallRequest MinimalUpdateRequest() => new()
    {
        Name = "Grand Hall",
        Address = "حي الشجاعية",
        Region = HallRegion.Gaza,
        Capacity = 200,
        Price = 1500,
        ShowPrice = true,
        ContactPhone = "+970599111111",
        Description = "Spacious hall",
        Photos = []
    };

    private HourlySlotService BuildHourlySlotService() => new(
        new HallRepository(_context),
        new BookingRepository(_context),
        new UnitOfWork(_context),
        new FakeCurrentUser("seeker-1", [ApplicationRoles.RegisteredUser]));

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        public FakeCurrentUser(string? userId, IReadOnlyList<string>? roles = null)
        {
            UserId = userId;
            IsAuthenticated = userId is not null;
            Roles = roles ?? [];
        }
        public string? UserId { get; }
        public string? UserName => "test";
        public string? Email => "test@example.com";
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles { get; }
    }

    private sealed class FakeOwnerBookingRequestNotifier : IOwnerBookingRequestNotifier
    {
        public Task NotifyBookingRequestReceivedAsync(
            string ownerUserId,
            OwnerBookingRequestNotificationEvent notification,
            CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task NotifyBookingRequestCancelledAsync(
            string ownerUserId,
            OwnerBookingCancellationNotificationEvent notification,
            CancellationToken cancellationToken = default)
            => Task.CompletedTask;
    }

    private sealed class FakeConversationRepository : IConversationRepository
    {
        private readonly Conversation? _conversation;

        public FakeConversationRepository(Conversation? conversation = null)
        {
            _conversation = conversation;
        }

        public Task<Conversation?> GetByIdWithHallAsync(Guid conversationId, CancellationToken cancellationToken = default)
            => Task.FromResult<Conversation?>(_conversation?.Id == conversationId ? _conversation : null);

        public Task<IReadOnlyList<Conversation>> GetParticipantConversationsAsync(string userId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<Conversation>>(_conversation is null
                ? []
                : [_conversation]);

        public Task<IReadOnlyList<UserDisplayInfo>> GetUserDisplayNamesAsync(IReadOnlyCollection<string> userIds, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<UserDisplayInfo>>([]);

        public Task<Conversation?> GetByHallAndUserAsync(Guid hallId, string userId, CancellationToken cancellationToken = default)
            => Task.FromResult<Conversation?>(_conversation is not null && _conversation.HallId == hallId && _conversation.SenderUserId == userId
                ? _conversation
                : null);

        public Task AddAsync(Conversation conversation, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task UpsertReadStateAsync(Guid conversationId, string userId, DateTimeOffset lastReadAt, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<int> GetUnreadConversationCountAsync(string userId, CancellationToken cancellationToken = default) => Task.FromResult(0);
        public Task<Dictionary<Guid, bool>> GetUnreadStatusAsync(string userId, IReadOnlyCollection<Guid> conversationIds, CancellationToken cancellationToken = default) => Task.FromResult<Dictionary<Guid, bool>>(new Dictionary<Guid, bool>());
    }

    private sealed class FakeMessageRepository : IMessageRepository
    {
        public Task AddAsync(Message message, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task SaveChangesAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<Message?> GetByIdAsync(Guid messageId, CancellationToken cancellationToken = default) => Task.FromResult<Message?>(null);

        public Task<Message?> GetByClientRequestIdAsync(string senderUserId, string clientRequestId, CancellationToken cancellationToken = default) => Task.FromResult<Message?>(null);
        public Task<IReadOnlyList<Message>> GetByConversationAsync(Guid conversationId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Message>>([]);
        public Task<IReadOnlyList<Message>> GetByConversationIdsAsync(IReadOnlyCollection<Guid> conversationIds, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Message>>([]);
    }

    private sealed class FakeBookingRejectionService : IBookingRejectionService
    {
        public Task<RejectBookingResultDto> RejectBookingAsync(Guid hallId, Guid bookingId, RejectBookingRequestDto request, CancellationToken cancellationToken = default)
            => Task.FromResult(new RejectBookingResultDto());
        public Task<int> DeliverPendingRejectionNotificationsAsync(CancellationToken cancellationToken = default) => Task.FromResult(0);
    }

    private sealed class FakeHallRepository : IHallRepository
    {
        public Task<Hall?> GetHallByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<Hall?>(null);
        public Task<IReadOnlyList<Hall>> GetApprovedHallsAsync(int count, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Hall>>([]);
        public Task<IReadOnlyList<Hall>> GetApprovedHallsByRegionAsync(HallRegion region, int count, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Hall>>([]);
        public Task<IReadOnlyList<Hall>> GetApprovedHallsPaginatedAsync(int skip, int take, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Hall>>([]);
        public Task<int> GetApprovedHallsCountAsync(CancellationToken cancellationToken = default) => Task.FromResult(0);
        public Task<IReadOnlyList<Hall>> SearchApprovedHallsAsync(string? name, HallRegion? region, string? area, DateOnly? date, TimeOnly? startTime, int skip, int take, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Hall>>([]);
        public Task<int> SearchApprovedHallsCountAsync(string? name, HallRegion? region, string? area, DateOnly? date, TimeOnly? startTime, CancellationToken cancellationToken = default) => Task.FromResult(0);
        public Task<IReadOnlyList<HallImage>> GetHallImagesAsync(Guid hallId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<HallImage>>([]);
    }

    private sealed class FakeConversationNotifier : IConversationNotifier
    {
        public Task NotifyMessageSentAsync(MessageSentEvent message, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class FakeDocumentStorage : IDocumentStorage
    {
        public string Root => Path.Combine(Path.GetTempPath(), "wesal-test-documents");

        public string OwnerDocumentsDirectory(string ownerId) => Path.Combine(Root, "documents", "owners", ownerId);

    
        public string ConversationAttachmentsDirectory(Guid conversationId) => Path.Combine(Root, "documents", "conversations", conversationId.ToString(), "attachments");
    }
}