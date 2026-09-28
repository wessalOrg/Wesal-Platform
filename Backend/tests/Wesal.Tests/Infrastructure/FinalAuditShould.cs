using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Common;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Halls;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Final integration audit (Edits 16-19, 22-29): cross-surface consistency proofs.
/// The hall's <see cref="HallBookingWindow"/> is the single rule every reader shares;
/// search honors it like booking does, and protected file streaming maps a missing
/// file to 404 on every document endpoint.
/// </summary>
public class FinalAuditShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public FinalAuditShould()
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
        TimeOnly? start = null,
        TimeOnly? end = null,
        HallStatus status = HallStatus.Approved)
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
            PaymentStatus = HallPaymentStatus.Paid,
            IsDeleted = false,
            HourlySlotStart = start,
            HourlySlotEnd = end,
            ShowBookedSlots = true
        };
        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    private static DateOnly Tomorrow() => DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);

    // ---------- Shared window rule ----------

    [Fact]
    public void BookingWindow_Defaults_AreNineToTwentyTwo()
    {
        Assert.Equal(new TimeOnly(9, 0), HallBookingWindow.DefaultStart);
        Assert.Equal(new TimeOnly(22, 0), HallBookingWindow.DefaultEnd);
        Assert.Equal(new TimeOnly(9, 0), HallBookingWindow.EffectiveStart(null));
        Assert.Equal(new TimeOnly(22, 0), HallBookingWindow.EffectiveEnd(null));
    }

    [Fact]
    public void BookingWindow_Contains_RespectsExclusiveEnd()
    {
        var hall = new Hall { HourlySlotStart = new TimeOnly(9, 0), HourlySlotEnd = new TimeOnly(21, 0) };

        Assert.True(HallBookingWindow.Contains(hall, new TimeOnly(9, 0)));
        Assert.True(HallBookingWindow.Contains(hall, new TimeOnly(20, 0)));
        Assert.False(HallBookingWindow.Contains(hall, new TimeOnly(21, 0)));
        Assert.False(HallBookingWindow.Contains(hall, new TimeOnly(8, 0)));
    }

    // ---------- Search honors the window like booking does ----------

    [Fact]
    public async Task Search_OutsideWorkingWindow_DoesNotOfferHall()
    {
        var owner = await CreateUserAsync("o1@example.com", "+970599100001", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id, start: new TimeOnly(9, 0), end: new TimeOnly(21, 0));
        var date = Tomorrow();
        var service = new HallSearchService(new HallRepository(_context));

        var inside = await service.SearchHallsAsync(new HallSearchRequest
        {
            Date = date,
            StartTime = new TimeOnly(20, 0),
            PageNumber = 1,
            PageSize = 12
        });
        Assert.Contains(inside.Items, item => item.HallId == hall.Id);

        var atClosing = await service.SearchHallsAsync(new HallSearchRequest
        {
            Date = date,
            StartTime = new TimeOnly(21, 0),
            PageNumber = 1,
            PageSize = 12
        });
        Assert.DoesNotContain(atClosing.Items, item => item.HallId == hall.Id);

        var beforeOpening = await service.SearchHallsAsync(new HallSearchRequest
        {
            Date = date,
            StartTime = new TimeOnly(8, 0),
            PageNumber = 1,
            PageSize = 12
        });
        Assert.DoesNotContain(beforeOpening.Items, item => item.HallId == hall.Id);
    }

    [Fact]
    public async Task Search_UnconfiguredWindow_UsesSharedDefaults()
    {
        var owner = await CreateUserAsync("o2@example.com", "+970599100002", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var date = Tomorrow();
        var service = new HallSearchService(new HallRepository(_context));

        var inside = await service.SearchHallsAsync(new HallSearchRequest
        {
            Date = date,
            StartTime = new TimeOnly(21, 0),
            PageNumber = 1,
            PageSize = 12
        });
        Assert.Contains(inside.Items, item => item.HallId == hall.Id);

        var outside = await service.SearchHallsAsync(new HallSearchRequest
        {
            Date = date,
            StartTime = new TimeOnly(22, 0),
            PageNumber = 1,
            PageSize = 12
        });
        Assert.DoesNotContain(outside.Items, item => item.HallId == hall.Id);
    }

    // ---------- Missing attachment file is a 404, never a 500 ----------

    [Fact]
    public async Task MissingAttachmentFile_ReturnsNotFound()
    {
        var owner = await CreateUserAsync("o3@example.com", "+970599100003", ApplicationRoles.HallOwner);
        var hall = AddHall(owner.Id);
        var conversation = new Conversation
        {
            HallId = hall.Id,
            SenderUserId = "admin-1",
            HallOwnerId = owner.Id
        };
        _context.Conversations.Add(conversation);
        await _context.SaveChangesAsync();

        // A message row whose file is gone from disk (stale reference, wiped volume).
        var message = new Message
        {
            ConversationId = conversation.Id,
            SenderUserId = "admin-1",
            Content = "Proof",
            AttachmentUrl = "/documents/conversations/gone/attachments/missing.jpg",
            AttachmentContentType = "image/jpeg",
            AttachmentFileName = "missing.jpg"
        };
        _context.Messages.Add(message);
        await _context.SaveChangesAsync();
        _context.ChangeTracker.Clear();

        var service = new ConversationService(
            new ConversationRepository(_context), new MessageRepository(_context),
            new FakeBookingRejectionService(), new NoOpBookingAcceptanceService(),
            new HallRepository(_context),
            new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner),
            new RecordingConversationNotifier(), new FakeAttachmentStorage());

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.GetMessageAttachmentAsync(conversation.Id, message.Id));
    }

    [Fact]
    public async Task StoredDocumentServe_MissingFile_ReturnsNotFound()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            Wesal.API.Infrastructure.StoredDocumentResult.ServeAsync(
                Path.Combine(Path.GetTempPath(), "wesal-audit-missing-" + Guid.NewGuid(), "gone.jpg"),
                "image/jpeg",
                CancellationToken.None));
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
    }
}
