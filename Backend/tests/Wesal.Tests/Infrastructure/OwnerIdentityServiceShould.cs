using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Profile;
using Wesal.Persistence.Data;

namespace Wesal.Tests.Infrastructure;

public class OwnerIdentityServiceShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public OwnerIdentityServiceShould()
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
    }

    private async Task<ApplicationUser> CreateOwnerAsync(string email, string phone)
    {
        var user = new ApplicationUser { FullName = "Hall Owner", Email = email, UserName = email, PhoneNumber = phone };
        await _userManager.CreateAsync(user, "Password123!");
        await _userManager.AddToRoleAsync(user, ApplicationRoles.HallOwner);
        return user;
    }

    private OwnerIdentityService CreateService(ICurrentUserService currentUser)
        => new(_userManager, currentUser, new FakeDocumentStorage());

    private static OwnerDocumentUpload ValidImage(string fileName = "id.jpg") => new()
    {
        FileName = fileName,
        ContentType = "image/jpeg",
        Content = new byte[] { 0xFF, 0xD8, 0xFF, 0x00, 0x00, 0x00 }
    };

    // --- US-OWNER-30: upload ---

    [Fact]
    public async Task Upload_SetsIdentityDocumentUrl_AndCanBeFetchedBack()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");

        var result = await CreateService(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
            .UploadIdentityDocumentAsync(ValidImage());

        Assert.True(result.HasDocument);
        Assert.NotNull(result.UploadedAt);

        var reloaded = await _context.Users.FindAsync(owner.Id);
        Assert.NotNull(reloaded!.IdentityDocumentUrl);
        Assert.Contains(owner.Id, reloaded.IdentityDocumentUrl);

        var stored = await CreateService(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
            .GetIdentityDocumentAsync();
        Assert.Equal(reloaded.IdentityDocumentUrl, stored.RelativeUrl);
        Assert.Equal("image/jpeg", stored.ContentType);
        Assert.True(File.Exists(stored.FullPath));
    }

    [Fact]
    public async Task Upload_InvalidFile_ThrowsValidation_AndSetsNothing()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");

        await Assert.ThrowsAsync<ValidationException>(() =>
            CreateService(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
                .UploadIdentityDocumentAsync(ValidImage("evil.exe")));

        var reloaded = await _context.Users.FindAsync(owner.Id);
        Assert.Null(reloaded!.IdentityDocumentUrl);
        Assert.Null(reloaded.IdentityDocumentUploadedAt);
    }

    [Fact]
    public async Task Upload_Unauthenticated_ThrowsUnauthorized()
    {
        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            CreateService(new FakeCurrentUser(null, false, ""))
                .UploadIdentityDocumentAsync(ValidImage()));
    }

    [Fact]
    public async Task Get_WithoutUpload_ThrowsNotFound()
    {
        var owner = await CreateOwnerAsync("owner@example.com", "+970599100001");

        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateService(new FakeCurrentUser(owner.Id, true, ApplicationRoles.HallOwner))
                .GetIdentityDocumentAsync());
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

    private sealed class FakeDocumentStorage : IDocumentStorage
    {
        public string Root => Path.Combine(Path.GetTempPath(), "wesal-test-documents");

        public string OwnerDocumentsDirectory(string ownerId) => Path.Combine(Root, "documents", "owners", ownerId);

    
        public string ConversationAttachmentsDirectory(Guid conversationId) => Path.Combine(Root, "documents", "conversations", conversationId.ToString(), "attachments");
    }
}