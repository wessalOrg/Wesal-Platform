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
using Wesal.Infrastructure.Coordinators;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;
using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// End-to-end tests for the Event Coordinator setup submission (WESAL coordinator
/// setup): both branches, every attachment count, the private-storage consistency
/// contract (files first, one transaction, cleanup on failure), the durable
/// "request received" notification, and the account-flag flip to setup-complete /
/// Pending that registration progression depends on.
/// </summary>
public class CoordinatorSetupShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly FakeIdentityDocumentStore _documentStore = new();
    private readonly FakeNotificationService _notificationService = new();
    private readonly RecordingNotificationDispatcher _dispatcher = new();

    public CoordinatorSetupShould()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(o =>
        {
            o.UseInMemoryDatabase(Guid.NewGuid().ToString());
            o.ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning));
        });
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
        _userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();

        var roleManager = _provider.GetRequiredService<RoleManager<ApplicationRole>>();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.EventCoordinator)).GetAwaiter().GetResult();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.RegisteredUser)).GetAwaiter().GetResult();
    }

    private CoordinatorSetupService CreateService(ApplicationUser user, bool authenticated = true, params string[] roles)
    {
        var currentUser = new FakeCurrentUser(
            authenticated ? user.Id : null,
            authenticated,
            roles.Length > 0 ? roles : new[] { ApplicationRoles.EventCoordinator });

        return new CoordinatorSetupService(
            currentUser,
            _userManager,
            new CoordinatorSetupRequestValidator(),
            _documentStore,
            new CoordinatorRepository(_context),
            new UserNotificationWriter(_context),
            new UnitOfWork(_context),
            _notificationService,
            _dispatcher,
            NullLogger<CoordinatorSetupService>.Instance);
    }

    private async Task<ApplicationUser> CreateCoordinatorAsync(
        string email,
        bool isSetupComplete = false,
        AccountApprovalStatus approvalStatus = AccountApprovalStatus.Pending)
    {
        var user = new ApplicationUser
        {
            FullName = "Coordinator",
            Email = email,
            UserName = email,
            IsSetupComplete = isSetupComplete,
            ApprovalStatus = approvalStatus
        };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(string.Join(",", result.Errors.Select(e => e.Description)));
        }
        await _userManager.AddToRoleAsync(user, ApplicationRoles.EventCoordinator);
        return user;
    }

    // --- Valid image / document fixtures with correct magic bytes ---------------------

    private static OwnerDocumentUpload Png(string name = "photo.png") => new()
    {
        FileName = name,
        ContentType = "image/png",
        Content = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x01, 0x02]
    };

    private static OwnerDocumentUpload Pdf(string name = "id.pdf") => new()
    {
        FileName = name,
        ContentType = "application/pdf",
        Content = [(byte)'%', (byte)'P', (byte)'D', (byte)'F', (byte)'-', 0x31, 0x2E, 0x34]
    };

    private static CoordinatorSetupSubmission ShopSubmission(
        OwnerDocumentUpload? shopPhoto = null,
        OwnerDocumentUpload? identityDocument = null)
        => new()
        {
            Form = new CoordinatorSetupRequest
            {
                BusinessType = CoordinatorBusinessType.Shop,
                ShopName = "Wesal Gifts",
                ShopLocation = "Ramallah, Main Street",
                PhoneNumber = "+970599111111"
            },
            ShopPhoto = shopPhoto,
            WorkPhotos = null,
            IdentityDocument = identityDocument
        };

    private static CoordinatorSetupSubmission CompleteShopSubmission()
        => ShopSubmission(shopPhoto: Png("shop.png"), identityDocument: Pdf());

    private static CoordinatorSetupSubmission FreelanceSubmission(
        IReadOnlyList<OwnerDocumentUpload>? workPhotos = null,
        OwnerDocumentUpload? identityDocument = null)
        => new()
        {
            Form = new CoordinatorSetupRequest
            {
                BusinessType = CoordinatorBusinessType.Freelance,
                OnlineStoreName = "Gift Studio Online",
                PhoneNumber = "+970599222222"
            },
            ShopPhoto = null,
            WorkPhotos = workPhotos,
            IdentityDocument = identityDocument
        };

    private static CoordinatorSetupSubmission CompleteFreelanceSubmission()
        => FreelanceSubmission(
            workPhotos: new List<OwnerDocumentUpload> { Png("work1.png"), Png("work2.png") },
            identityDocument: Pdf());

    // --- Happy paths ------------------------------------------------------------------

    [Fact]
    public async Task ShopSubmission_CommitsProfileFlagsAndDurableNotification()
    {
        var user = await CreateCoordinatorAsync("shop@example.com");
        var service = CreateService(user);

        var result = await service.SubmitSetupAsync(CompleteShopSubmission());

        Assert.True(result.IsSetupComplete);
        Assert.Equal(AccountApprovalStatus.Pending, result.ApprovalStatus);
        Assert.Equal(CoordinatorBusinessType.Shop, result.BusinessType);

        var profile = await _context.CoordinatorProfiles.AsNoTracking().SingleAsync(p => p.UserId == user.Id);
        Assert.Equal(CoordinatorBusinessType.Shop, profile.BusinessType);
        Assert.Equal("Wesal Gifts", profile.ShopName);
        Assert.Equal("Ramallah, Main Street", profile.ShopLocation);
        Assert.Equal("+970599111111", profile.PhoneNumber);
        Assert.Null(profile.OnlineStoreName);
        Assert.Null(profile.WorkPhoto1Url);
        Assert.Null(profile.WorkPhoto2Url);
        Assert.StartsWith("/documents/coordinators/", profile.ShopPhotoUrl);
        Assert.StartsWith("/documents/coordinators/", profile.IdentityDocumentUrl);

        var persisted = await _userManager.FindByIdAsync(user.Id);
        Assert.True(persisted!.IsSetupComplete);
        Assert.Equal(AccountApprovalStatus.Pending, persisted.ApprovalStatus);

        var notification = await _context.UserNotifications.AsNoTracking().SingleAsync();
        Assert.Equal(user.Id, notification.RecipientUserId);
        Assert.Equal(NotificationKind.CoordinatorSetupReceivedForCoordinator, notification.Kind);
        Assert.Equal("تم استلام طلبك", notification.Title);
        Assert.Equal("وصل طلب التسجيل بنجاح، وسيتم مراجعته من الإدارة.", notification.Body);
        Assert.False(string.IsNullOrWhiteSpace(notification.Title));
        Assert.False(string.IsNullOrWhiteSpace(notification.Body));
        Assert.Null(notification.ReadAt);

        Assert.Single(_dispatcher.Dispatches);
        Assert.True(_dispatcher.Has(NotificationKind.CoordinatorSetupReceivedForCoordinator, user.Id));
    }

    [Fact]
    public async Task FreelanceSubmission_WithExactlyTwoWorkPhotos_Commits()
    {
        var user = await CreateCoordinatorAsync("freelance@example.com");
        var service = CreateService(user);

        var result = await service.SubmitSetupAsync(CompleteFreelanceSubmission());

        Assert.True(result.IsSetupComplete);
        Assert.Equal(CoordinatorBusinessType.Freelance, result.BusinessType);

        var profile = await _context.CoordinatorProfiles.AsNoTracking().SingleAsync(p => p.UserId == user.Id);
        Assert.Equal("Gift Studio Online", profile.OnlineStoreName);
        Assert.Null(profile.ShopName);
        Assert.Null(profile.ShopLocation);
        Assert.Null(profile.ShopPhotoUrl);
        Assert.StartsWith("/documents/coordinators/", profile.WorkPhoto1Url);
        Assert.StartsWith("/documents/coordinators/", profile.WorkPhoto2Url);
        Assert.NotEqual(profile.WorkPhoto1Url, profile.WorkPhoto2Url);
    }

    [Fact]
    public async Task SuccessfulSubmission_IdentityDocumentMayBePdf()
    {
        var user = await CreateCoordinatorAsync("pdf@example.com");
        var service = CreateService(user);

        await service.SubmitSetupAsync(CompleteShopSubmission());

        var profile = await _context.CoordinatorProfiles.AsNoTracking().SingleAsync(p => p.UserId == user.Id);
        Assert.EndsWith(".pdf", profile.IdentityDocumentUrl);
    }

    [Fact]
    public async Task RejectedCoordinator_CanResubmitValidatedData_AndReturnsToPending()
    {
        var user = await CreateCoordinatorAsync("resubmit@example.com");
        var service = CreateService(user);
        await service.SubmitSetupAsync(CompleteShopSubmission());
        user = (await _userManager.FindByIdAsync(user.Id))!;
        user.ApprovalStatus = AccountApprovalStatus.Rejected;
        await _userManager.UpdateAsync(user);

        var result = await service.ResubmitSetupAsync(CompleteFreelanceSubmission());

        var updated = await _context.CoordinatorProfiles.AsNoTracking().SingleAsync(p => p.UserId == user.Id);
        var persisted = await _userManager.FindByIdAsync(user.Id);
        Assert.Equal(AccountApprovalStatus.Pending, result.ApprovalStatus);
        Assert.Equal(AccountApprovalStatus.Pending, persisted!.ApprovalStatus);
        Assert.Equal(CoordinatorBusinessType.Freelance, updated.BusinessType);
        Assert.Equal("Gift Studio Online", updated.OnlineStoreName);
        Assert.Null(updated.ShopPhotoUrl);
        Assert.Equal(2, await _context.UserNotifications.CountAsync(n => n.RecipientUserId == user.Id));
        Assert.Equal(2, _dispatcher.Dispatches.Count(d => d.RecipientUserId == user.Id));
    }

    [Fact]
    public async Task CoordinatorResubmission_IsRejectedUnlessCurrentUserOwnsRejectedRequest()
    {
        var owner = await CreateCoordinatorAsync("resubmit-owner@example.com");
        var other = await CreateCoordinatorAsync("resubmit-other@example.com", isSetupComplete: true, approvalStatus: AccountApprovalStatus.Rejected);
        await CreateService(owner).SubmitSetupAsync(CompleteShopSubmission());

        var exception = await Assert.ThrowsAsync<NotFoundException>(() => CreateService(other).ResubmitSetupAsync(CompleteShopSubmission()));

        Assert.Equal(owner.Id, (await _context.CoordinatorProfiles.AsNoTracking().SingleAsync()).UserId);
        Assert.Equal(AccountApprovalStatus.Pending, (await _userManager.FindByIdAsync(owner.Id))!.ApprovalStatus);
    }

    [Fact]
    public async Task CoordinatorResubmission_RevalidatesFreelanceAttachmentCount()
    {
        var user = await CreateCoordinatorAsync("resubmit-invalid@example.com");
        var service = CreateService(user);
        await service.SubmitSetupAsync(CompleteShopSubmission());
        user = (await _userManager.FindByIdAsync(user.Id))!;
        user.ApprovalStatus = AccountApprovalStatus.Rejected;
        await _userManager.UpdateAsync(user);
        var filesBefore = _documentStore.Files.Count;
        var invalid = new CoordinatorSetupSubmission
        {
            Form = new CoordinatorSetupRequest
            {
                BusinessType = CoordinatorBusinessType.Freelance,
                OnlineStoreName = "Online gifts",
                PhoneNumber = "+970599111111"
            },
            WorkPhotos = [Png("only-one.png")],
            IdentityDocument = Pdf()
        };

        await Assert.ThrowsAsync<ValidationException>(() => service.ResubmitSetupAsync(invalid));

        Assert.Equal(filesBefore, _documentStore.Files.Count);
        Assert.Equal(AccountApprovalStatus.Rejected, (await _userManager.FindByIdAsync(user.Id))!.ApprovalStatus);
    }

    // --- Branch-conditional attachment rules -------------------------------------------

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(3)]
    public async Task FreelanceSubmission_WrongWorkPhotoCount_Rejected(int count)
    {
        var user = await CreateCoordinatorAsync($"photos{count}@example.com");
        var service = CreateService(user);

        var photos = Enumerable.Range(0, count).Select(_ => Png()).ToList();
        var submission = FreelanceSubmission(workPhotos: photos);

        var exception = await Assert.ThrowsAsync<ValidationException>(() => service.SubmitSetupAsync(submission));
        Assert.Contains("WorkPhotos", exception.Errors.Keys);

        Assert.Empty(_context.CoordinatorProfiles);
        Assert.False((await _userManager.FindByIdAsync(user.Id))!.IsSetupComplete);
        Assert.Empty(_documentStore.Files);
    }

    [Fact]
    public async Task ShopSubmission_WithWorkPhotos_Rejected()
    {
        var user = await CreateCoordinatorAsync("shopwithwork@example.com");
        var service = CreateService(user);

        var submission = CompleteShopSubmission();
        submission = new CoordinatorSetupSubmission
        {
            Form = submission.Form,
            ShopPhoto = submission.ShopPhoto,
            WorkPhotos = new List<OwnerDocumentUpload> { Png() },
            IdentityDocument = submission.IdentityDocument
        };

        var exception = await Assert.ThrowsAsync<ValidationException>(() => service.SubmitSetupAsync(submission));
        Assert.Contains("WorkPhotos", exception.Errors.Keys);
        Assert.Empty(_documentStore.Files);
    }

    [Fact]
    public async Task FreelanceSubmission_WithShopPhoto_Rejected()
    {
        var user = await CreateCoordinatorAsync("freelancewithshop@example.com");
        var service = CreateService(user);

        var baseSubmission = FreelanceSubmission();
        var submission = new CoordinatorSetupSubmission
        {
            Form = baseSubmission.Form,
            ShopPhoto = Png(),
            WorkPhotos = baseSubmission.WorkPhotos,
            IdentityDocument = baseSubmission.IdentityDocument
        };

        var exception = await Assert.ThrowsAsync<ValidationException>(() => service.SubmitSetupAsync(submission));
        Assert.Contains("ShopPhoto", exception.Errors.Keys);
        Assert.Empty(_documentStore.Files);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task MissingIdentityDocument_RejectedForBothBranches(bool shop)
    {
        var user = await CreateCoordinatorAsync($"noid-{shop}@example.com");
        var service = CreateService(user);

        var submission = shop
            ? ShopSubmission(shopPhoto: Png(), identityDocument: null)
            : FreelanceSubmission(
                workPhotos: new List<OwnerDocumentUpload> { Png("work1.png"), Png("work2.png") },
                identityDocument: null);

        var exception = await Assert.ThrowsAsync<ValidationException>(() => service.SubmitSetupAsync(submission));
        Assert.Contains("IdentityDocument", exception.Errors.Keys);
        Assert.Empty(_documentStore.Files);
        Assert.Empty(_context.CoordinatorProfiles);
    }

    [Fact]
    public async Task ShopSubmission_MissingShopPhoto_Rejected_BeforeAnyFileIsWritten()
    {
        var user = await CreateCoordinatorAsync("noshopphoto@example.com");
        var service = CreateService(user);

        var exception = await Assert.ThrowsAsync<ValidationException>(
            () => service.SubmitSetupAsync(ShopSubmission(shopPhoto: null)));
        Assert.Contains("ShopPhoto", exception.Errors.Keys);
        Assert.Empty(_documentStore.Files);
    }

    [Fact]
    public async Task DisallowedFileExtension_Rejected_BeforeAnyFileIsWritten()
    {
        var user = await CreateCoordinatorAsync("exe@example.com");
        var service = CreateService(user);

        var disguised = new OwnerDocumentUpload
        {
            FileName = "shop.exe",
            ContentType = "image/png",
            Content = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
        };

        var exception = await Assert.ThrowsAsync<ValidationException>(
            () => service.SubmitSetupAsync(ShopSubmission(shopPhoto: disguised)));
        Assert.Empty(_documentStore.Files);
    }

    [Fact]
    public async Task InvalidForm_MissingShopName_Rejected()
    {
        var user = await CreateCoordinatorAsync("badform@example.com");
        var service = CreateService(user);

        var submission = ShopSubmission();
        var invalid = new CoordinatorSetupSubmission
        {
            Form = new CoordinatorSetupRequest
            {
                BusinessType = CoordinatorBusinessType.Shop,
                ShopName = "",
                ShopLocation = "Ramallah",
                PhoneNumber = "+970599111111"
            },
            ShopPhoto = submission.ShopPhoto,
            WorkPhotos = null,
            IdentityDocument = submission.IdentityDocument
        };

        await Assert.ThrowsAsync<ValidationException>(() => service.SubmitSetupAsync(invalid));
        Assert.Empty(_documentStore.Files);
        Assert.Empty(_context.CoordinatorProfiles);
    }

    // --- Authorization and lifecycle rules ---------------------------------------------

    [Fact]
    public async Task Unauthenticated_ThrowsUnauthorized()
    {
        var user = await CreateCoordinatorAsync("anon@example.com");
        var service = CreateService(user, authenticated: false);

        await Assert.ThrowsAsync<UnauthorizedException>(() => service.SubmitSetupAsync(ShopSubmission()));
        Assert.Empty(_documentStore.Files);
        Assert.Empty(_context.CoordinatorProfiles);
    }

    [Fact]
    public async Task WrongRole_ThrowsForbidden_AndWritesNothing()
    {
        var user = await CreateCoordinatorAsync("wrongrole@example.com");
        var service = CreateService(user, roles: ApplicationRoles.RegisteredUser);

        await Assert.ThrowsAsync<ForbiddenException>(() => service.SubmitSetupAsync(ShopSubmission()));
        Assert.Empty(_documentStore.Files);
        Assert.Empty(_context.CoordinatorProfiles);
        Assert.False((await _userManager.FindByIdAsync(user.Id))!.IsSetupComplete);
    }

    [Fact]
    public async Task MissingUser_ThrowsNotFound()
    {
        var user = await CreateCoordinatorAsync("ghost@example.com");
        var service = CreateService(user);
        await _userManager.DeleteAsync(user);

        await Assert.ThrowsAsync<NotFoundException>(() => service.SubmitSetupAsync(ShopSubmission()));
        Assert.Empty(_documentStore.Files);
    }

    [Fact]
    public async Task SecondSubmission_ThrowsConflict()
    {
        var user = await CreateCoordinatorAsync("duplicate@example.com");
        var service = CreateService(user);

        await service.SubmitSetupAsync(CompleteShopSubmission());

        await Assert.ThrowsAsync<ConflictException>(() => service.SubmitSetupAsync(CompleteShopSubmission()));
        Assert.Single(_context.CoordinatorProfiles);
    }

    [Fact]
    public async Task Submission_AppliesOnlyToTheAuthenticatedCaller()
    {
        var caller = await CreateCoordinatorAsync("caller@example.com");
        var other = await CreateCoordinatorAsync("other@example.com");
        var service = CreateService(caller);

        await service.SubmitSetupAsync(CompleteShopSubmission());

        Assert.Single(_context.CoordinatorProfiles.AsNoTracking(), p => p.UserId == caller.Id);
        Assert.Empty(_context.CoordinatorProfiles.AsNoTracking().Where(p => p.UserId == other.Id));

        var otherPersisted = await _userManager.FindByIdAsync(other.Id);
        Assert.False(otherPersisted!.IsSetupComplete);
        Assert.Equal(AccountApprovalStatus.Pending, otherPersisted.ApprovalStatus);
    }

    // --- The consistency contract: bytes first, one transaction, cleanup on failure ----

    [Fact]
    public async Task StoreFailure_LeavesNoDatabaseState_AndPropagates()
    {
        var user = await CreateCoordinatorAsync("storefail@example.com");
        _documentStore.ThrowOnSave = true;
        var service = CreateService(user);

        await Assert.ThrowsAsync<IOException>(() => service.SubmitSetupAsync(CompleteShopSubmission()));

        Assert.Empty(_context.CoordinatorProfiles);
        Assert.Empty(_context.UserNotifications);
        Assert.False((await _userManager.FindByIdAsync(user.Id))!.IsSetupComplete);
    }

    [Fact]
    public async Task MidUploadFailure_DeletesAlreadyUploadedFiles()
    {
        var user = await CreateCoordinatorAsync("midfail@example.com");
        // Freelance saves work photo 1, work photo 2, then the ID document; fail on the
        // third write so the first two must be compensated.
        _documentStore.ThrowOnSaveAtCall = 3;
        var service = CreateService(user);

        await Assert.ThrowsAsync<IOException>(() => service.SubmitSetupAsync(CompleteFreelanceSubmission()));

        Assert.Empty(_documentStore.Files);
        Assert.Empty(_context.CoordinatorProfiles);
        Assert.Empty(_context.UserNotifications);
        Assert.False((await _userManager.FindByIdAsync(user.Id))!.IsSetupComplete);
    }

    [Fact]
    public async Task DatabaseFailure_DeletesUploadedFiles_AndLeavesAccountIncomplete()
    {
        var user = await CreateCoordinatorAsync("dbfail@example.com");
        var service = new CoordinatorSetupService(
            new FakeCurrentUser(user.Id, true, ApplicationRoles.EventCoordinator),
            _userManager,
            new CoordinatorSetupRequestValidator(),
            _documentStore,
            new CoordinatorRepository(_context),
            new UserNotificationWriter(_context),
            new ThrowingUnitOfWork(),
            _notificationService,
            _dispatcher,
            NullLogger<CoordinatorSetupService>.Instance);

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.SubmitSetupAsync(CompleteShopSubmission()));

        Assert.Empty(_documentStore.Files);
        Assert.Empty(_context.CoordinatorProfiles);
        Assert.Empty(_context.UserNotifications);
        Assert.False((await _userManager.FindByIdAsync(user.Id))!.IsSetupComplete);
    }

    [Fact]
    public async Task DispatchFailure_NeverFailsTheSubmission_NorDeletesCommittedFiles()
    {
        var user = await CreateCoordinatorAsync("dispatchfail@example.com");
        _dispatcher.ThrowOnDispatch = new InvalidOperationException("hub is down");
        var service = CreateService(user);

        var result = await service.SubmitSetupAsync(CompleteShopSubmission());

        Assert.True(result.IsSetupComplete);
        Assert.Equal(AccountApprovalStatus.Pending, result.ApprovalStatus);
        // The committed files must survive a failed realtime push.
        Assert.NotEmpty(_documentStore.Files);
        Assert.Single(_context.CoordinatorProfiles);
        var persisted = await _userManager.FindByIdAsync(user.Id);
        Assert.True(persisted!.IsSetupComplete);
    }

    // --- Information-hiding ------------------------------------------------------------

    [Fact]
    public async Task ResultAndResponses_NeverExposeDocumentUrlsOrStorageKeys()
    {
        var user = await CreateCoordinatorAsync("noleak@example.com");
        var service = CreateService(user);

        var result = await service.SubmitSetupAsync(CompleteShopSubmission());

        var json = System.Text.Json.JsonSerializer.Serialize(result);
        Assert.DoesNotContain("documents/", json);
        Assert.DoesNotContain("coordinators/", json);
        Assert.DoesNotContain(".png", json);
        Assert.DoesNotContain(".pdf", json);

        var profile = await _context.CoordinatorProfiles.AsNoTracking().SingleAsync(p => p.UserId == user.Id);

        // Profile endpoints surface status only, never the stored document locations.
        var profileService = new Wesal.Infrastructure.Profile.ProfileService(
            _userManager,
            new FakeCurrentUser(user.Id, true, ApplicationRoles.EventCoordinator));
        var profileResponse = await profileService.GetProfileAsync();
        Assert.True(profileResponse.IsSetupComplete);
        Assert.Equal(nameof(AccountApprovalStatus.Pending), profileResponse.ApprovalStatus);

        var profileJson = System.Text.Json.JsonSerializer.Serialize(profileResponse);
        Assert.DoesNotContain(profile.ShopPhotoUrl!, profileJson);
        Assert.DoesNotContain(profile.IdentityDocumentUrl!, profileJson);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }

    // --- Test doubles -------------------------------------------------------------------

    private sealed class FakeIdentityDocumentStore : IIdentityDocumentStore
    {
        public Dictionary<string, byte[]> Files { get; } = new(StringComparer.Ordinal);

        public bool ThrowOnSave { get; set; }

        /// <summary>1-based call counter: throw on the Nth SaveAsync call.</summary>
        public int? ThrowOnSaveAtCall { get; set; }

        private int _saveCalls;

        public Task SaveAsync(string relativeUrl, byte[] content, CancellationToken cancellationToken = default)
        {
            _saveCalls++;
            if (ThrowOnSave || (ThrowOnSaveAtCall is int at && _saveCalls == at))
            {
                throw new IOException("The document store rejected the write.");
            }

            Files[relativeUrl] = content;
            return Task.CompletedTask;
        }

        public Task<StoredDocumentContent?> ReadAsync(string relativeUrl, CancellationToken cancellationToken = default)
            => Task.FromResult(Files.TryGetValue(relativeUrl, out var bytes)
                ? new StoredDocumentContent { Bytes = bytes }
                : null);

        public Task DeleteAsync(string relativeUrl, CancellationToken cancellationToken = default)
        {
            Files.Remove(relativeUrl);
            return Task.CompletedTask;
        }
    }

    private sealed class ThrowingUnitOfWork : IUnitOfWork
    {
        public Task ExecuteInTransactionAsync(Func<Task> operation, CancellationToken cancellationToken = default)
            => throw new InvalidOperationException("The database transaction failed.");

        public Task<TResult> ExecuteInTransactionAsync<TResult>(Func<Task<TResult>> operation, CancellationToken cancellationToken = default)
            => throw new InvalidOperationException("The database transaction failed.");

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
            => throw new InvalidOperationException("The database transaction failed.");
    }

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        public FakeCurrentUser(string? userId, bool isAuthenticated, params string[] roles)
        {
            UserId = userId;
            IsAuthenticated = isAuthenticated;
            Roles = roles;
        }

        public string? UserId { get; }
        public string? UserName => "test";
        public string? Email => "test@example.com";
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles { get; }
    }
}
