using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Interfaces.Persistence;
using Wesal.Application.Common.Models;
using Wesal.Application.Common.Validation;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Domain.Notifications;
using Wesal.Infrastructure.Documents;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Photographers;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;
using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// End-to-end tests for the Photographer account setup submission (WESAL photographer
/// setup): both branches of the form, the required personal ID document, the
/// private-storage consistency contract (bytes first, one transaction, cleanup on
/// failure), the durable "request received" notification, the account-flag flip to
/// setup-complete / Pending, and the STRICT admin-only handling of the no-studio full
/// name.
/// </summary>
public class PhotographerSetupShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly FakeIdentityDocumentStore _documentStore = new();
    private readonly FakeNotificationService _notificationService = new();
    private readonly RecordingNotificationDispatcher _dispatcher = new();

    public PhotographerSetupShould()
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
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.Photographer)).GetAwaiter().GetResult();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.RegisteredUser)).GetAwaiter().GetResult();
    }

    private PhotographerSetupService CreateService(ApplicationUser user, bool authenticated = true, params string[] roles)
    {
        var currentUser = new FakeCurrentUser(
            authenticated ? user.Id : null,
            authenticated,
            roles.Length > 0 ? roles : new[] { ApplicationRoles.Photographer });

        return new PhotographerSetupService(
            currentUser,
            _userManager,
            new PhotographerSetupRequestValidator(),
            _documentStore,
            new PhotographerRepository(_context),
            new UserNotificationWriter(_context),
            new UnitOfWork(_context),
            _notificationService,
            _dispatcher,
            NullLogger<PhotographerSetupService>.Instance);
    }

    private async Task<ApplicationUser> CreatePhotographerAsync(
        string email,
        bool isSetupComplete = false,
        AccountApprovalStatus approvalStatus = AccountApprovalStatus.Pending)
    {
        var user = new ApplicationUser
        {
            FullName = "Registration Name",
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
        await _userManager.AddToRoleAsync(user, ApplicationRoles.Photographer);
        return user;
    }

    // --- Valid identity-document fixtures with correct magic bytes ----------------------

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

    private static PhotographerSetupSubmission StudioSubmission(OwnerDocumentUpload? identityDocument = null)
        => new()
        {
            Form = new PhotographerSetupRequest
            {
                HasStudio = true,
                StudioName = "Noor Studio",
                StudioLocation = "Ramallah, Main Street",
                DetailedStudioLocation = "Al-Irsal Street, next to the bank, second floor",
                PhoneNumber = "+970599111111"
            },
            IdentityDocument = identityDocument
        };

    private static PhotographerSetupSubmission NoStudioSubmission(OwnerDocumentUpload? identityDocument = null)
        => new()
        {
            Form = new PhotographerSetupRequest
            {
                HasStudio = false,
                FullName = "Ahmad Khalil",
                PhoneNumber = "+970599222222"
            },
            IdentityDocument = identityDocument
        };

    private static PhotographerSetupSubmission CompleteStudioSubmission()
        => StudioSubmission(identityDocument: Pdf());

    private static PhotographerSetupSubmission CompleteNoStudioSubmission()
        => NoStudioSubmission(identityDocument: Png());

    // --- Happy paths --------------------------------------------------------------------

    [Fact]
    public async Task StudioSubmission_CommitsProfileFlagsAndDurableNotification()
    {
        var user = await CreatePhotographerAsync("studio@example.com");
        var service = CreateService(user);

        var result = await service.SubmitSetupAsync(CompleteStudioSubmission());

        Assert.True(result.IsSetupComplete);
        Assert.Equal(AccountApprovalStatus.Pending, result.ApprovalStatus);
        Assert.True(result.HasStudio);

        var profile = await _context.PhotographerProfiles.AsNoTracking().SingleAsync(p => p.UserId == user.Id);
        Assert.True(profile.HasStudio);
        Assert.Equal("Noor Studio", profile.StudioName);
        Assert.Equal("Ramallah, Main Street", profile.StudioLocation);
        Assert.Equal("Al-Irsal Street, next to the bank, second floor", profile.DetailedStudioLocation);
        Assert.Equal("+970599111111", profile.PhoneNumber);
        Assert.Null(profile.FullName);
        Assert.StartsWith("/documents/photographers/", profile.IdentityDocumentUrl);

        var persisted = await _userManager.FindByIdAsync(user.Id);
        Assert.True(persisted!.IsSetupComplete);
        Assert.Equal(AccountApprovalStatus.Pending, persisted.ApprovalStatus);

        var notification = await _context.UserNotifications.AsNoTracking().SingleAsync();
        Assert.Equal(user.Id, notification.RecipientUserId);
        Assert.Equal(NotificationKind.PhotographerSetupReceivedForPhotographer, notification.Kind);
        Assert.False(string.IsNullOrWhiteSpace(notification.Title));
        Assert.False(string.IsNullOrWhiteSpace(notification.Body));
        Assert.Null(notification.ReadAt);

        Assert.Single(_dispatcher.Dispatches);
        Assert.True(_dispatcher.Has(NotificationKind.PhotographerSetupReceivedForPhotographer, user.Id));
    }

    [Fact]
    public async Task NoStudioSubmission_CommitsAdminOnlyFullNameAndFlags()
    {
        var user = await CreatePhotographerAsync("nostudio@example.com");
        var service = CreateService(user);

        var result = await service.SubmitSetupAsync(CompleteNoStudioSubmission());

        Assert.True(result.IsSetupComplete);
        Assert.False(result.HasStudio);

        var profile = await _context.PhotographerProfiles.AsNoTracking().SingleAsync(p => p.UserId == user.Id);
        Assert.False(profile.HasStudio);
        Assert.Equal("Ahmad Khalil", profile.FullName);
        Assert.Null(profile.StudioName);
        Assert.Null(profile.StudioLocation);
        Assert.Null(profile.DetailedStudioLocation);
        Assert.Equal("+970599222222", profile.PhoneNumber);
        Assert.StartsWith("/documents/photographers/", profile.IdentityDocumentUrl);
        Assert.EndsWith(".png", profile.IdentityDocumentUrl);

        var persisted = await _userManager.FindByIdAsync(user.Id);
        Assert.True(persisted!.IsSetupComplete);
        Assert.Equal(AccountApprovalStatus.Pending, persisted.ApprovalStatus);

        Assert.True(_dispatcher.Has(NotificationKind.PhotographerSetupReceivedForPhotographer, user.Id));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task PdfIdentityDocument_IsAcceptedForBothBranches(bool hasStudio)
    {
        var user = await CreatePhotographerAsync($"pdf-{hasStudio}@example.com");
        var service = CreateService(user);

        var submission = hasStudio ? CompleteStudioSubmission() : NoStudioSubmission(Pdf());
        await service.SubmitSetupAsync(submission);

        var profile = await _context.PhotographerProfiles.AsNoTracking().SingleAsync(p => p.UserId == user.Id);
        Assert.EndsWith(".pdf", profile.IdentityDocumentUrl);
    }

    // --- Branch rules --------------------------------------------------------------------

    [Fact]
    public async Task HasStudio_Missing_Rejected_BeforeAnyFileIsWritten()
    {
        var user = await CreatePhotographerAsync("noanswer@example.com");
        var service = CreateService(user);

        var submission = new PhotographerSetupSubmission
        {
            Form = new PhotographerSetupRequest
            {
                StudioName = "Noor Studio",
                StudioLocation = "Ramallah, Main Street",
                DetailedStudioLocation = "Al-Irsal Street",
                PhoneNumber = "+970599111111"
            },
            IdentityDocument = Pdf()
        };

        var exception = await Assert.ThrowsAsync<ValidationException>(() => service.SubmitSetupAsync(submission));
        Assert.Contains(nameof(PhotographerSetupRequest.HasStudio), exception.Errors.Keys);
        Assert.Empty(_documentStore.Files);
        Assert.Empty(_context.PhotographerProfiles);
    }

    [Fact]
    public async Task InvalidForm_MissingStudioName_Rejected()
    {
        var user = await CreatePhotographerAsync("badstudio@example.com");
        var service = CreateService(user);

        var submission = new PhotographerSetupSubmission
        {
            Form = new PhotographerSetupRequest
            {
                HasStudio = true,
                StudioName = "",
                StudioLocation = "Ramallah, Main Street",
                DetailedStudioLocation = "Al-Irsal Street",
                PhoneNumber = "+970599111111"
            },
            IdentityDocument = Pdf()
        };

        var exception = await Assert.ThrowsAsync<ValidationException>(() => service.SubmitSetupAsync(submission));
        Assert.Contains(nameof(PhotographerSetupRequest.StudioName), exception.Errors.Keys);
        Assert.Empty(_documentStore.Files);
        Assert.Empty(_context.PhotographerProfiles);
        Assert.False((await _userManager.FindByIdAsync(user.Id))!.IsSetupComplete);
    }

    [Fact]
    public async Task NoStudioSubmission_MissingFullName_Rejected()
    {
        var user = await CreatePhotographerAsync("noname@example.com");
        var service = CreateService(user);

        var submission = new PhotographerSetupSubmission
        {
            Form = new PhotographerSetupRequest
            {
                HasStudio = false,
                FullName = "   ",
                PhoneNumber = "+970599222222"
            },
            IdentityDocument = Png()
        };

        var exception = await Assert.ThrowsAsync<ValidationException>(() => service.SubmitSetupAsync(submission));
        Assert.Contains(nameof(PhotographerSetupRequest.FullName), exception.Errors.Keys);
        Assert.Empty(_documentStore.Files);
        Assert.Empty(_context.PhotographerProfiles);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task MissingIdentityDocument_RejectedForBothBranches_BeforeAnyFileIsWritten(bool hasStudio)
    {
        var user = await CreatePhotographerAsync($"noid-{hasStudio}@example.com");
        var service = CreateService(user);

        var submission = hasStudio ? StudioSubmission(null) : NoStudioSubmission(null);

        var exception = await Assert.ThrowsAsync<ValidationException>(() => service.SubmitSetupAsync(submission));
        Assert.Contains("IdentityDocument", exception.Errors.Keys);
        Assert.Empty(_documentStore.Files);
        Assert.Empty(_context.PhotographerProfiles);
        Assert.False((await _userManager.FindByIdAsync(user.Id))!.IsSetupComplete);
    }

    [Fact]
    public async Task CrossBranchFields_AreIgnoredNotPersisted_NoStudioBranch()
    {
        // Studio answers supplied on a no-studio submission must not leak into storage:
        // the branch is decided solely by HasStudio.
        var user = await CreatePhotographerAsync("cross1@example.com");
        var service = CreateService(user);

        var submission = new PhotographerSetupSubmission
        {
            Form = new PhotographerSetupRequest
            {
                HasStudio = false,
                FullName = "Ahmad Khalil",
                StudioName = "Sneaky Studio",
                StudioLocation = "Sneaky Location",
                DetailedStudioLocation = "Sneaky Detailed",
                PhoneNumber = "+970599222222"
            },
            IdentityDocument = Png()
        };

        await service.SubmitSetupAsync(submission);

        var profile = await _context.PhotographerProfiles.AsNoTracking().SingleAsync(p => p.UserId == user.Id);
        Assert.Null(profile.StudioName);
        Assert.Null(profile.StudioLocation);
        Assert.Null(profile.DetailedStudioLocation);
        Assert.Equal("Ahmad Khalil", profile.FullName);
    }

    [Fact]
    public async Task CrossBranchFields_AreIgnoredNotPersisted_StudioBranch()
    {
        var user = await CreatePhotographerAsync("cross2@example.com");
        var service = CreateService(user);

        var submission = new PhotographerSetupSubmission
        {
            Form = new PhotographerSetupRequest
            {
                HasStudio = true,
                StudioName = "Noor Studio",
                StudioLocation = "Ramallah, Main Street",
                DetailedStudioLocation = "Al-Irsal Street",
                FullName = "Sneaky Name",
                PhoneNumber = "+970599111111"
            },
            IdentityDocument = Pdf()
        };

        await service.SubmitSetupAsync(submission);

        var profile = await _context.PhotographerProfiles.AsNoTracking().SingleAsync(p => p.UserId == user.Id);
        Assert.Null(profile.FullName);
        Assert.Equal("Noor Studio", profile.StudioName);
    }

    // --- File validation -----------------------------------------------------------------

    [Fact]
    public async Task DisallowedFileExtension_Rejected_BeforeAnyFileIsWritten()
    {
        var user = await CreatePhotographerAsync("exe@example.com");
        var service = CreateService(user);

        var disguised = new OwnerDocumentUpload
        {
            FileName = "id.exe",
            ContentType = "image/png",
            Content = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
        };

        var exception = await Assert.ThrowsAsync<ValidationException>(
            () => service.SubmitSetupAsync(StudioSubmission(disguised)));
        Assert.Contains(
            "not permitted",
            string.Join(" ", exception.Errors.Values.SelectMany(v => v)),
            StringComparison.OrdinalIgnoreCase);
        Assert.Empty(_documentStore.Files);
    }

    [Fact]
    public async Task DisallowedMagicBytes_Rejected_BeforeAnyFileIsWritten()
    {
        var user = await CreatePhotographerAsync("magic@example.com");
        var service = CreateService(user);

        var garbage = new OwnerDocumentUpload
        {
            FileName = "id.png",
            ContentType = "image/png",
            Content = "MZ-not-a-real-image"u8.ToArray()
        };

        var exception = await Assert.ThrowsAsync<ValidationException>(
            () => service.SubmitSetupAsync(StudioSubmission(garbage)));
        Assert.Contains(
            "does not match",
            string.Join(" ", exception.Errors.Values.SelectMany(v => v)),
            StringComparison.OrdinalIgnoreCase);
        Assert.Empty(_documentStore.Files);
    }

    [Fact]
    public async Task OversizedFile_Rejected_BeforeAnyFileIsWritten()
    {
        var user = await CreatePhotographerAsync("big@example.com");
        var service = CreateService(user);

        var oversized = new OwnerDocumentUpload
        {
            FileName = "id.png",
            ContentType = "image/png",
            Content = new byte[(int)DocumentUploadValidator.MaxFileSize + 1]
        };

        var exception = await Assert.ThrowsAsync<ValidationException>(
            () => service.SubmitSetupAsync(StudioSubmission(oversized)));
        Assert.Contains(
            "5MB",
            string.Join(" ", exception.Errors.Values.SelectMany(v => v)),
            StringComparison.OrdinalIgnoreCase);
        Assert.Empty(_documentStore.Files);
    }

    // --- Authorization and lifecycle rules -----------------------------------------------

    [Fact]
    public async Task Unauthenticated_ThrowsUnauthorized()
    {
        var user = await CreatePhotographerAsync("anon@example.com");
        var service = CreateService(user, authenticated: false);

        await Assert.ThrowsAsync<UnauthorizedException>(() => service.SubmitSetupAsync(CompleteStudioSubmission()));
        Assert.Empty(_documentStore.Files);
        Assert.Empty(_context.PhotographerProfiles);
    }

    [Fact]
    public async Task WrongRole_ThrowsForbidden_AndWritesNothing()
    {
        var user = await CreatePhotographerAsync("wrongrole@example.com");
        var service = CreateService(user, roles: ApplicationRoles.RegisteredUser);

        await Assert.ThrowsAsync<ForbiddenException>(() => service.SubmitSetupAsync(CompleteStudioSubmission()));
        Assert.Empty(_documentStore.Files);
        Assert.Empty(_context.PhotographerProfiles);
        Assert.False((await _userManager.FindByIdAsync(user.Id))!.IsSetupComplete);
    }

    [Fact]
    public async Task MissingUser_ThrowsNotFound()
    {
        var user = await CreatePhotographerAsync("ghost@example.com");
        var service = CreateService(user);
        await _userManager.DeleteAsync(user);

        await Assert.ThrowsAsync<NotFoundException>(() => service.SubmitSetupAsync(CompleteStudioSubmission()));
        Assert.Empty(_documentStore.Files);
    }

    [Fact]
    public async Task SecondSubmission_ThrowsConflict()
    {
        var user = await CreatePhotographerAsync("duplicate@example.com");
        var service = CreateService(user);

        await service.SubmitSetupAsync(CompleteStudioSubmission());

        await Assert.ThrowsAsync<ConflictException>(() => service.SubmitSetupAsync(CompleteStudioSubmission()));
        Assert.Single(_context.PhotographerProfiles);
    }

    [Fact]
    public async Task Submission_AppliesOnlyToTheAuthenticatedCaller()
    {
        var caller = await CreatePhotographerAsync("caller@example.com");
        var other = await CreatePhotographerAsync("other@example.com");
        var service = CreateService(caller);

        await service.SubmitSetupAsync(CompleteStudioSubmission());

        Assert.Single(_context.PhotographerProfiles.AsNoTracking(), p => p.UserId == caller.Id);
        Assert.Empty(_context.PhotographerProfiles.AsNoTracking().Where(p => p.UserId == other.Id));

        var otherPersisted = await _userManager.FindByIdAsync(other.Id);
        Assert.False(otherPersisted!.IsSetupComplete);
        Assert.Equal(AccountApprovalStatus.Pending, otherPersisted.ApprovalStatus);
    }

    // --- The consistency contract: bytes first, one transaction, cleanup on failure ------

    [Fact]
    public async Task StoreFailure_LeavesNoDatabaseState_AndPropagates()
    {
        var user = await CreatePhotographerAsync("storefail@example.com");
        _documentStore.ThrowOnSave = true;
        var service = CreateService(user);

        await Assert.ThrowsAsync<IOException>(() => service.SubmitSetupAsync(CompleteStudioSubmission()));

        Assert.Empty(_context.PhotographerProfiles);
        Assert.Empty(_context.UserNotifications);
        Assert.False((await _userManager.FindByIdAsync(user.Id))!.IsSetupComplete);
    }

    [Fact]
    public async Task DatabaseFailure_DeletesUploadedFiles_AndLeavesAccountIncomplete()
    {
        var user = await CreatePhotographerAsync("dbfail@example.com");
        var service = new PhotographerSetupService(
            new FakeCurrentUser(user.Id, true, ApplicationRoles.Photographer),
            _userManager,
            new PhotographerSetupRequestValidator(),
            _documentStore,
            new PhotographerRepository(_context),
            new UserNotificationWriter(_context),
            new ThrowingUnitOfWork(),
            _notificationService,
            _dispatcher,
            NullLogger<PhotographerSetupService>.Instance);

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.SubmitSetupAsync(CompleteStudioSubmission()));

        Assert.Empty(_documentStore.Files);
        Assert.Empty(_context.PhotographerProfiles);
        Assert.Empty(_context.UserNotifications);
        Assert.False((await _userManager.FindByIdAsync(user.Id))!.IsSetupComplete);
    }

    [Fact]
    public async Task DispatchFailure_NeverFailsTheSubmission_NorDeletesCommittedFiles()
    {
        var user = await CreatePhotographerAsync("dispatchfail@example.com");
        _dispatcher.ThrowOnDispatch = new InvalidOperationException("hub is down");
        var service = CreateService(user);

        var result = await service.SubmitSetupAsync(CompleteStudioSubmission());

        Assert.True(result.IsSetupComplete);
        Assert.Equal(AccountApprovalStatus.Pending, result.ApprovalStatus);
        // The committed file must survive a failed realtime push.
        Assert.NotEmpty(_documentStore.Files);
        Assert.Single(_context.PhotographerProfiles);
        var persisted = await _userManager.FindByIdAsync(user.Id);
        Assert.True(persisted!.IsSetupComplete);
    }

    // --- Information-hiding ----------------------------------------------------------------

    [Fact]
    public async Task ResultAndResponses_NeverExposeDocumentUrlsKeysOrTheAdminOnlyFullName()
    {
        var user = await CreatePhotographerAsync("noleak@example.com");
        var service = CreateService(user);

        var result = await service.SubmitSetupAsync(NoStudioSubmission(Png()));

        var json = System.Text.Json.JsonSerializer.Serialize(result);
        Assert.DoesNotContain("documents/", json);
        Assert.DoesNotContain("photographers/", json);
        Assert.DoesNotContain(".png", json);
        Assert.DoesNotContain(".pdf", json);
        Assert.DoesNotContain("Ahmad Khalil", json);

        var profile = await _context.PhotographerProfiles.AsNoTracking().SingleAsync(p => p.UserId == user.Id);

        // Profile endpoints surface status only, never the stored document locations and
        // never the setup-submitted full name (the profile FullName is the registration
        // name of the authenticated user).
        var profileService = new Wesal.Infrastructure.Profile.ProfileService(
            _userManager,
            new FakeCurrentUser(user.Id, true, ApplicationRoles.Photographer));
        var profileResponse = await profileService.GetProfileAsync();
        Assert.True(profileResponse.IsSetupComplete);
        Assert.Equal(nameof(AccountApprovalStatus.Pending), profileResponse.ApprovalStatus);

        var profileJson = System.Text.Json.JsonSerializer.Serialize(profileResponse);
        Assert.DoesNotContain("Ahmad Khalil", profileJson);
        Assert.DoesNotContain(profile.IdentityDocumentUrl!, profileJson);
    }

    [Fact]
    public async Task SetupNotification_ContentNeverContainsTheAdminOnlyFullName()
    {
        var user = await CreatePhotographerAsync("notifnoleak@example.com");
        var service = CreateService(user);

        await service.SubmitSetupAsync(NoStudioSubmission(Png()));

        var notification = await _context.UserNotifications.AsNoTracking().SingleAsync();
        Assert.DoesNotContain("Ahmad Khalil", notification.Title);
        Assert.DoesNotContain("Ahmad Khalil", notification.Body);
        Assert.Equal(
            NotificationKind.PhotographerSetupReceivedForPhotographer,
            notification.Kind);
    }

    // --- Storage-key validation ------------------------------------------------------------

    [Fact]
    public void PhotographerDocumentObjectKey_AcceptsValidUrl_AndRejectsTraversal()
    {
        Assert.Equal(
            "photographers/user-1/id.pdf",
            DocumentPath.PhotographerDocumentObjectKey("/documents/photographers/user-1/id.pdf"));

        Assert.Null(DocumentPath.PhotographerDocumentObjectKey("/documents/photographers/user-1"));
        Assert.Null(DocumentPath.PhotographerDocumentObjectKey("/documents/photographers/user-1/a/b.png"));
        Assert.Null(DocumentPath.PhotographerDocumentObjectKey("/documents/photographers/../admin/secret.png"));
        Assert.Null(DocumentPath.PhotographerDocumentObjectKey("/documents/owners/user-1/id.pdf"));
        Assert.Null(DocumentPath.PhotographerDocumentObjectKey(""));
    }

    [Fact]
    public void ProtectedDocumentObjectKey_ResolvesPhotographerUrls_AndCrossSegmentsFail()
    {
        Assert.Equal(
            "photographers/user-1/id.pdf",
            DocumentPath.ProtectedDocumentObjectKey("/documents/photographers/user-1/id.pdf"));

        Assert.Null(DocumentPath.ProtectedDocumentObjectKey("/documents/coordinators/user-1/../photographers/x/y.png"));
        Assert.Null(DocumentPath.ProtectedDocumentObjectKey("/upload/photographers/user-1/id.pdf"));
        Assert.Null(DocumentPath.OwnerIdentityObjectKey("/documents/photographers/user-1/id.pdf"));
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }

    // --- Test doubles -----------------------------------------------------------------------

    private sealed class FakeIdentityDocumentStore : IIdentityDocumentStore
    {
        public Dictionary<string, byte[]> Files { get; } = new(StringComparer.Ordinal);

        public bool ThrowOnSave { get; set; }

        public Task SaveAsync(string relativeUrl, byte[] content, CancellationToken cancellationToken = default)
        {
            if (ThrowOnSave)
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
