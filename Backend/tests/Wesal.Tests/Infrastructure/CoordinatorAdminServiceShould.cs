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
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Admin;
using Wesal.Infrastructure.Coordinators;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;
using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Administrator-only reads of a coordinator's personal ID document: the bytes flow
/// through the authorization-protected service path (never a public URL), a user
/// without a submission returns 404 so the endpoint cannot probe arbitrary accounts,
/// and a missing document is 404 rather than an empty success.
/// </summary>
public class CoordinatorAdminServiceShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly FakeStore _store = new();

    public CoordinatorAdminServiceShould()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(o => o.UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));
        services.AddIdentityCore<ApplicationUser>().AddRoles<ApplicationRole>().AddEntityFrameworkStores<ApplicationDbContext>();
        services.AddLogging();
        _provider = services.BuildServiceProvider();
        _context = _provider.GetRequiredService<ApplicationDbContext>();
        _context.Database.EnsureCreated();
        _userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
    }

    private CoordinatorAdminService CreateService() => new(
        _userManager,
        new CoordinatorRepository(_context),
        _store,
        new UnitOfWork(_context),
        CreateReviewActions(_context));

    private static AccountRequestReviewActions CreateReviewActions(ApplicationDbContext context)
        => new(
            new FakeCurrentUser(),
            new ConversationRepository(context),
            new MessageRepository(context),
            new UserNotificationWriter(context),
            new FakeNotificationService(),
            new RecordingNotificationDispatcher(),
            NullLogger<AccountRequestReviewActions>.Instance);

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        public string? UserId => null;
        public string? UserName => null;
        public string? Email => null;
        public bool IsAuthenticated => false;
        public IReadOnlyList<string> Roles => [];
    }

    private async Task<ApplicationUser> CreateCoordinatorWithProfileAsync(
        string email,
        string? identityDocumentUrl = "documents/coordinators/{0}/id.pdf",
        AccountApprovalStatus approvalStatus = AccountApprovalStatus.Pending)
    {
        var user = new ApplicationUser { FullName = "Coordinator", Email = email, UserName = email, ApprovalStatus = approvalStatus };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(string.Join(",", result.Errors.Select(e => e.Description)));
        }

        var url = identityDocumentUrl is null ? string.Empty : string.Format(identityDocumentUrl, user.Id);
        _context.CoordinatorProfiles.Add(new CoordinatorProfile
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            BusinessType = CoordinatorBusinessType.Shop,
            ShopName = "Shop",
            ShopLocation = "Location",
            PhoneNumber = "+970599111111",
            IdentityDocumentUrl = url,
            SubmittedAt = DateTimeOffset.UtcNow
        });
        await _context.SaveChangesAsync();

        if (!string.IsNullOrEmpty(url))
        {
            _store.Documents[url] = [(byte)'%', (byte)'P', (byte)'D', (byte)'F', (byte)'-', 0x31];
        }

        return user;
    }

    [Fact]
    public async Task ReturnsTheStoredBytes_WithContentTypeAndFileName()
    {
        var user = await CreateCoordinatorWithProfileAsync("adminread@example.com");
        var service = CreateService();

        var document = await service.GetCoordinatorIdentityDocumentAsync(user.Id);

        Assert.NotNull(document.Content);
        Assert.Equal((byte)'%', document.Content![0]);
        Assert.Equal("application/pdf", document.ContentType);
        Assert.Equal("id.pdf", document.FileName);
        Assert.StartsWith($"documents/coordinators/{user.Id}/", document.RelativeUrl);
    }

    [Fact]
    public async Task UserWithoutCoordinatorProfile_ReturnsNotFound()
    {
        var user = new ApplicationUser { FullName = "Plain", Email = "plain@example.com", UserName = "plain@example.com" };
        await _userManager.CreateAsync(user, "Password123!");
        var service = CreateService();

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetCoordinatorIdentityDocumentAsync(user.Id));
    }

    [Fact]
    public async Task UnknownUserId_ReturnsNotFound()
    {
        var service = CreateService();
        await Assert.ThrowsAsync<NotFoundException>(() => service.GetCoordinatorIdentityDocumentAsync(Guid.NewGuid().ToString()));
    }

    [Fact]
    public async Task ProfileWithEmptyDocumentUrl_ReturnsNotFound()
    {
        var user = await CreateCoordinatorWithProfileAsync("empty@example.com", identityDocumentUrl: null);
        var service = CreateService();

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetCoordinatorIdentityDocumentAsync(user.Id));
    }

    [Fact]
    public async Task DocumentMissingFromStore_ReturnsNotFound()
    {
        var user = await CreateCoordinatorWithProfileAsync("missing@example.com");
        _store.Documents.Clear();
        var service = CreateService();

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetCoordinatorIdentityDocumentAsync(user.Id));
    }

    [Fact]
    public async Task Result_NeverCarriesAPublicUrl()
    {
        var user = await CreateCoordinatorWithProfileAsync("nourl@example.com");
        var service = CreateService();

        var document = await service.GetCoordinatorIdentityDocumentAsync(user.Id);

        Assert.DoesNotContain("http", document.RelativeUrl, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("supabase", document.RelativeUrl, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("http", document.FullPath, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RejectWithoutReasonFailsValidation()
    {
        var user = await CreateCoordinatorWithProfileAsync("reject-empty@example.com");

        await Assert.ThrowsAsync<ValidationException>(() => CreateService().RejectCoordinatorRequestAsync(user.Id, new AdminRejectAccountRequestDto { Reason = "  " }));

        Assert.Equal(AccountApprovalStatus.Pending, (await _userManager.FindByIdAsync(user.Id))!.ApprovalStatus);
        Assert.Empty(_context.UserNotifications);
    }

    [Fact]
    public async Task RejectionPersistsExactNotificationAndAdminConversationTarget()
    {
        var user = await CreateCoordinatorWithProfileAsync("reject@example.com");
        const string reason = "Missing shop photo";

        await CreateService().RejectCoordinatorRequestAsync(user.Id, new AdminRejectAccountRequestDto { Reason = reason });

        var notification = await _context.UserNotifications.SingleAsync(n => n.RecipientUserId == user.Id);
        Assert.Equal("تعذر قبول طلبك", notification.Title);
        Assert.Equal($"تم رفض طلبك للسبب الاتي : \"{reason}\"", notification.Body);
        Assert.Equal(NotificationActionTarget.Conversation, notification.ActionTarget);
        var conversation = await _context.Conversations.SingleAsync(c => c.HallOwnerId == user.Id && c.HallId == null);
        Assert.Equal(conversation.Id.ToString(), notification.TargetId);
        Assert.Equal(AccountApprovalStatus.Rejected, (await _userManager.FindByIdAsync(user.Id))!.ApprovalStatus);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }

    private sealed class FakeStore : IIdentityDocumentStore
    {
        public Dictionary<string, byte[]> Documents { get; } = new(StringComparer.Ordinal);

        public Task SaveAsync(string relativeUrl, byte[] content, CancellationToken cancellationToken = default)
        {
            Documents[relativeUrl] = content;
            return Task.CompletedTask;
        }

        public Task<StoredDocumentContent?> ReadAsync(string relativeUrl, CancellationToken cancellationToken = default)
            => Task.FromResult(Documents.TryGetValue(relativeUrl, out var bytes)
                ? new StoredDocumentContent { Bytes = bytes }
                : null);

        public Task DeleteAsync(string relativeUrl, CancellationToken cancellationToken = default)
        {
            Documents.Remove(relativeUrl);
            return Task.CompletedTask;
        }
    }
}
