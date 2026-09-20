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
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.OwnerDashboard;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

public class PaymentReceiptServiceShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly FakeNotifier _notifier;

    public PaymentReceiptServiceShould()
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
        _userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
        _notifier = new FakeNotifier();
    }

    private async Task<ApplicationUser> CreateOwnerAsync(string email, string phone)
    {
        var user = new ApplicationUser { FullName = "Hall Owner", Email = email, UserName = email, PhoneNumber = phone };
        await _userManager.CreateAsync(user, "Password123!");
        await _userManager.AddToRoleAsync(user, ApplicationRoles.HallOwner);
        return user;
    }

    private Hall AddHall(string ownerId, string name, HallStatus status, HallPaymentStatus paymentStatus)
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
            PaymentStatus = paymentStatus
        };
        _context.Halls.Add(hall);
        _context.SaveChanges();
        return hall;
    }

    private PaymentReceiptService CreateService(ICurrentUserService currentUser)
        => new(
            new OwnerDashboardRepository(_context),
            new ConversationRepository(_context),
            new MessageRepository(_context),
            _notifier,
            _userManager,
            currentUser,
            new FakeDocumentStorage(),
            new UnitOfWork(_context),
            new FakeDateTime(new DateTimeOffset(2026, 8, 15, 10, 0, 0, TimeSpan.Zero)),
            NullLogger<PaymentReceiptService>.Instance);

    private static OwnerDocumentUpload ValidReceipt(string fileName = "receipt.pdf") => new()
    {
        FileName = fileName,
        ContentType = "application/pdf",
        Content = new byte[] { 0x25, 0x50, 0x44, 0x46, 0x2D } // %PDF-
    };

    // --- US-OWNER-31: upload ---

    [Fact]
    public async Task Upload_ApprovedUnpaidHall_SetsReceiptUploaded_AndNotifiesAdmin()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.Approved, HallPaymentStatus.Unpaid);

        var result = await CreateService(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
            .UploadPaymentReceiptAsync(hall.Id, ValidReceipt());

        Assert.True(result.HasReceipt);
        Assert.Equal(hall.Id, result.HallId);
        Assert.Equal(HallPaymentStatus.ReceiptUploaded, result.PaymentStatus);

        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.Equal(HallPaymentStatus.ReceiptUploaded, reloaded!.PaymentStatus);
        Assert.NotNull(reloaded.PaymentReceiptUrl);
        Assert.NotNull(reloaded.PaymentReceiptUploadedAt);

        var message = await _context.Messages
            .Include(m => m.Conversation)
            .OrderByDescending(m => m.CreatedAt)
            .FirstOrDefaultAsync();
        Assert.NotNull(message);
        Assert.Contains("إشعار دفع", message!.Content);
        Assert.Equal(hall.Id, message.Conversation.HallId);
        Assert.Equal(owner.Id, message.Conversation.HallOwnerId);
        Assert.Single(_notifier.SentEvents);
        Assert.Equal(message.Id, _notifier.SentEvents[0].MessageId);
    }

    // --- US-OWNER-31 / US-ADMIN-07: upload restricted to owner of the hall ---

    [Fact]
    public async Task Upload_NotOwnedHall_ThrowsNotFound()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var other = await CreateOwnerAsync("other@example.com", "+970599100002");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.Approved, HallPaymentStatus.Unpaid);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateService(new FakeCurrentUser(other.Id, true, ApplicationRoles.HallOwner))
                .UploadPaymentReceiptAsync(hall.Id, ValidReceipt()));
    }

    // --- US-OWNER-31: only Approved halls accept a receipt ---

    [Fact]
    public async Task Upload_NotApprovedHall_ThrowsBusinessRule()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.PendingReview, HallPaymentStatus.Unpaid);

        await Assert.ThrowsAsync<BusinessRuleException>(() =>
            CreateService(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
                .UploadPaymentReceiptAsync(hall.Id, ValidReceipt()));
    }

    // --- US-ADMIN-10: a paid hall needs no further receipt ---

    [Fact]
    public async Task Upload_AlreadyPaidHall_ThrowsConflict()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.Approved, HallPaymentStatus.Paid);

        await Assert.ThrowsAsync<ConflictException>(() =>
            CreateService(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
                .UploadPaymentReceiptAsync(hall.Id, ValidReceipt()));

        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.Equal(HallPaymentStatus.Paid, reloaded!.PaymentStatus);
    }

    [Fact]
    public async Task Upload_InvalidFile_ThrowsValidation_AndChangesNothing()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.Approved, HallPaymentStatus.Unpaid);

        var bad = ValidReceipt("evil.exe");
        await Assert.ThrowsAsync<ValidationException>(() =>
            CreateService(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
                .UploadPaymentReceiptAsync(hall.Id, bad));

        var reloaded = await _context.Halls.FindAsync(hall.Id);
        Assert.Equal(HallPaymentStatus.Unpaid, reloaded!.PaymentStatus);
        Assert.Null(reloaded.PaymentReceiptUrl);
        Assert.Empty(await _context.Messages.ToListAsync());
    }

    [Fact]
    public async Task Upload_Unauthenticated_ThrowsUnauthorized()
    {
        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            CreateService(new FakeCurrentUser(null, false, ""))
                .UploadPaymentReceiptAsync(Guid.NewGuid(), ValidReceipt()));
    }

    // --- US-OWNER-31: download ---

    [Fact]
    public async Task GetReceipt_WithoutUpload_ThrowsNotFound()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");
        var hall = AddHall(owner.Id, "Grand Hall", HallStatus.Approved, HallPaymentStatus.ReceiptUploaded);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateService(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
                .GetPaymentReceiptAsync(hall.Id));
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
        public List<MessageSentEvent> SentEvents { get; } = new();
        public Task NotifyMessageSentAsync(MessageSentEvent message, CancellationToken cancellationToken = default)
        {
            SentEvents.Add(message);
            return Task.CompletedTask;
        }
    }

    private sealed class FakeDocumentStorage : IDocumentStorage
    {
        public string Root => Path.Combine(Path.GetTempPath(), "wesal-test-documents");

        public string OwnerDocumentsDirectory(string ownerId) => Path.Combine(Root, "documents", "owners", ownerId);

        public string HallReceiptsDirectory(Guid hallId) => Path.Combine(Root, "documents", "halls", hallId.ToString(), "receipts");
    }
}