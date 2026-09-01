using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Profile;
using Wesal.Persistence.Data;

namespace Wesal.Tests.Infrastructure;

public class ProfileServiceShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public ProfileServiceShould()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(o => o.UseInMemoryDatabase(Guid.NewGuid().ToString()));
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
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.RegisteredUser)).GetAwaiter().GetResult();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.HallOwner)).GetAwaiter().GetResult();
        _userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
    }

    private async Task<ApplicationUser> CreateUserAsync(string email, string phone, string role, string fullName = "Test User")
    {
        var user = new ApplicationUser { FullName = fullName, Email = email, UserName = email, PhoneNumber = phone };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded) throw new Exception(string.Join(",", result.Errors.Select(e => e.Description)));
        await _userManager.AddToRoleAsync(user, role);
        return user;
    }

    private sealed class FakeCurrentUser : Wesal.Application.Common.Interfaces.ICurrentUserService
    {
        public FakeCurrentUser(string? userId, bool auth, params string[] roles)
        {
            UserId = userId;
            IsAuthenticated = auth;
            Roles = roles;
        }
        public string? UserId { get; }
        public string? UserName => "test";
        public string? Email => "test@example.com";
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles { get; }
    }

    [Fact]
    public async Task GetProfile_AuthenticatedUser_ReturnsOwnProfile()
    {
        var user = await CreateUserAsync("profile@example.com", "+970599111111", ApplicationRoles.RegisteredUser);
        var service = new ProfileService(_userManager, new FakeCurrentUser(user.Id, true, ApplicationRoles.RegisteredUser));
        var result = await service.GetProfileAsync();
        Assert.Equal("profile@example.com", result.Email);
        Assert.Equal("+970599111111", result.PhoneNumber);
        Assert.Equal(user.FullName, result.FullName);
        Assert.False(string.IsNullOrWhiteSpace(result.ConcurrencyStamp));
        // No password hash
        Assert.DoesNotContain("Password", System.Text.Json.JsonSerializer.Serialize(result));
    }

    [Fact]
    public async Task GetProfile_Unauthenticated_ThrowsUnauthorized()
    {
        var service = new ProfileService(_userManager, new FakeCurrentUser(null, false));
        await Assert.ThrowsAsync<UnauthorizedException>(() => service.GetProfileAsync());
    }

    [Fact]
    public async Task UpdateProfile_Unauthenticated_ThrowsUnauthorized()
    {
        var service = new ProfileService(_userManager, new FakeCurrentUser(null, false));
        await Assert.ThrowsAsync<UnauthorizedException>(() => service.UpdateProfileAsync(new UpdateProfileRequest { FullName = "A", Email = "a@b.com", PhoneNumber = "+970599000001", ConcurrencyStamp = null }));
    }

    [Fact]
    public async Task UpdateProfile_Success_Name()
    {
        var user = await CreateUserAsync("updatename@example.com", "+970599222222", ApplicationRoles.RegisteredUser);
        var service = new ProfileService(_userManager, new FakeCurrentUser(user.Id, true, ApplicationRoles.RegisteredUser));
        var updated = await service.UpdateProfileAsync(new UpdateProfileRequest { FullName = "New Name", Email = "updatename@example.com", PhoneNumber = "+970599222222", ConcurrencyStamp = user.ConcurrencyStamp });
        Assert.Equal("New Name", updated.FullName);
        var reloaded = await _userManager.FindByIdAsync(user.Id);
        Assert.Equal("New Name", reloaded!.FullName);
    }

    [Fact]
    public async Task UpdateProfile_Success_Email()
    {
        var user = await CreateUserAsync("oldemail@example.com", "+970599333333", ApplicationRoles.RegisteredUser);
        var service = new ProfileService(_userManager, new FakeCurrentUser(user.Id, true, ApplicationRoles.RegisteredUser));
        var updated = await service.UpdateProfileAsync(new UpdateProfileRequest { FullName = user.FullName, Email = "newemail@example.com", PhoneNumber = "+970599333333", ConcurrencyStamp = user.ConcurrencyStamp });
        Assert.Equal("newemail@example.com", updated.Email);
    }

    [Fact]
    public async Task UpdateProfile_Success_Phone()
    {
        var user = await CreateUserAsync("phoneupdate@example.com", "+970599444444", ApplicationRoles.RegisteredUser);
        var service = new ProfileService(_userManager, new FakeCurrentUser(user.Id, true, ApplicationRoles.RegisteredUser));
        var updated = await service.UpdateProfileAsync(new UpdateProfileRequest { FullName = user.FullName, Email = "phoneupdate@example.com", PhoneNumber = "+970599555555", ConcurrencyStamp = user.ConcurrencyStamp });
        Assert.Equal("+970599555555", updated.PhoneNumber);
    }

    [Fact]
    public async Task UpdateProfile_Success_MultipleFields()
    {
        var user = await CreateUserAsync("multi@example.com", "+970599666666", ApplicationRoles.RegisteredUser);
        var service = new ProfileService(_userManager, new FakeCurrentUser(user.Id, true, ApplicationRoles.RegisteredUser));
        var updated = await service.UpdateProfileAsync(new UpdateProfileRequest { FullName = "Multi Updated", Email = "multi2@example.com", PhoneNumber = "+970599777777", ConcurrencyStamp = user.ConcurrencyStamp });
        Assert.Equal("Multi Updated", updated.FullName);
        Assert.Equal("multi2@example.com", updated.Email);
        Assert.Equal("+970599777777", updated.PhoneNumber);
    }

    [Fact]
    public async Task UpdateProfile_InvalidEmail_ThrowsValidation()
    {
        var user = await CreateUserAsync("invalidemail@example.com", "+970599888888", ApplicationRoles.RegisteredUser);
        var service = new ProfileService(_userManager, new FakeCurrentUser(user.Id, true, ApplicationRoles.RegisteredUser));
        await Assert.ThrowsAsync<ValidationException>(() => service.UpdateProfileAsync(new UpdateProfileRequest { FullName = "A", Email = "bad", PhoneNumber = "+970599888888" }));
    }

    [Fact]
    public async Task UpdateProfile_InvalidPhone_ThrowsValidation()
    {
        var user = await CreateUserAsync("invalidphone@example.com", "+970599999999", ApplicationRoles.RegisteredUser);
        var service = new ProfileService(_userManager, new FakeCurrentUser(user.Id, true, ApplicationRoles.RegisteredUser));
        await Assert.ThrowsAsync<ValidationException>(() => service.UpdateProfileAsync(new UpdateProfileRequest { FullName = "A", Email = "invalidphone@example.com", PhoneNumber = "abc" }));
    }

    [Fact]
    public async Task UpdateProfile_DuplicateEmail_ThrowsConflict()
    {
        var u1 = await CreateUserAsync("dup1@example.com", "+970599000001", ApplicationRoles.RegisteredUser);
        var u2 = await CreateUserAsync("dup2@example.com", "+970599000002", ApplicationRoles.RegisteredUser);
        var service = new ProfileService(_userManager, new FakeCurrentUser(u2.Id, true, ApplicationRoles.RegisteredUser));
        await Assert.ThrowsAsync<ConflictException>(() => service.UpdateProfileAsync(new UpdateProfileRequest { FullName = u2.FullName, Email = "dup1@example.com", PhoneNumber = u2.PhoneNumber! }));
    }

    [Fact]
    public async Task UpdateProfile_DuplicatePhone_ThrowsConflict()
    {
        var u1 = await CreateUserAsync("dupphone1@example.com", "+970599000003", ApplicationRoles.RegisteredUser);
        var u2 = await CreateUserAsync("dupphone2@example.com", "+970599000004", ApplicationRoles.RegisteredUser);
        var service = new ProfileService(_userManager, new FakeCurrentUser(u2.Id, true, ApplicationRoles.RegisteredUser));
        await Assert.ThrowsAsync<ConflictException>(() => service.UpdateProfileAsync(new UpdateProfileRequest { FullName = u2.FullName, Email = u2.Email!, PhoneNumber = "+970599000003" }));
    }

    [Fact]
    public async Task UpdateProfile_KeepOwnEmail_NotDuplicate()
    {
        var user = await CreateUserAsync("keepown@example.com", "+970599000005", ApplicationRoles.RegisteredUser);
        var service = new ProfileService(_userManager, new FakeCurrentUser(user.Id, true, ApplicationRoles.RegisteredUser));
        var updated = await service.UpdateProfileAsync(new UpdateProfileRequest { FullName = "Keep", Email = "keepown@example.com", PhoneNumber = "+970599000005", ConcurrencyStamp = user.ConcurrencyStamp });
        Assert.Equal("keepown@example.com", updated.Email);
    }

    [Fact]
    public async Task UpdateProfile_ClientCannotAccessAnotherUser()
    {
        var u1 = await CreateUserAsync("victim@example.com", "+970599000006", ApplicationRoles.RegisteredUser);
        var u2 = await CreateUserAsync("attacker@example.com", "+970599000007", ApplicationRoles.RegisteredUser);
        var service = new ProfileService(_userManager, new FakeCurrentUser(u2.Id, true, ApplicationRoles.RegisteredUser));
        // Attacker tries to update victim by manipulating request - service must still operate on authenticated user (u2)
        var updated = await service.UpdateProfileAsync(new UpdateProfileRequest { FullName = "Hacked", Email = "attacker@example.com", PhoneNumber = "+970599000007", ConcurrencyStamp = u2.ConcurrencyStamp });
        Assert.Equal("Hacked", updated.FullName);
        var victim = await _userManager.FindByIdAsync(u1.Id);
        Assert.NotEqual("Hacked", victim!.FullName);
    }

    [Fact]
    public async Task UpdateProfile_StaleConcurrency_ThrowsConflict()
    {
        var user = await CreateUserAsync("concur@example.com", "+970599000008", ApplicationRoles.RegisteredUser);
        var service1 = new ProfileService(_userManager, new FakeCurrentUser(user.Id, true, ApplicationRoles.RegisteredUser));
        var profile = await service1.GetProfileAsync();
        // Simulate concurrent update
        var service2 = new ProfileService(_userManager, new FakeCurrentUser(user.Id, true, ApplicationRoles.RegisteredUser));
        await service2.UpdateProfileAsync(new UpdateProfileRequest { FullName = "Concurrent", Email = "concur@example.com", PhoneNumber = "+970599000008", ConcurrencyStamp = profile.ConcurrencyStamp });
        // Now stale update with old stamp should fail
        await Assert.ThrowsAsync<ConflictException>(() => service1.UpdateProfileAsync(new UpdateProfileRequest { FullName = "Stale", Email = "concur@example.com", PhoneNumber = "+970599000008", ConcurrencyStamp = profile.ConcurrencyStamp }));
        var latest = await _userManager.FindByIdAsync(user.Id);
        Assert.Equal("Concurrent", latest!.FullName);
    }

    [Fact]
    public async Task UpdateProfile_Atomic_NoPartialUpdateOnDuplicateEmail()
    {
        var u1 = await CreateUserAsync("atomic1@example.com", "+970599000009", ApplicationRoles.RegisteredUser);
        var u2 = await CreateUserAsync("atomic2@example.com", "+970599000010", ApplicationRoles.RegisteredUser);
        var service = new ProfileService(_userManager, new FakeCurrentUser(u2.Id, true, ApplicationRoles.RegisteredUser));
        var originalName = u2.FullName;
        await Assert.ThrowsAsync<ConflictException>(() => service.UpdateProfileAsync(new UpdateProfileRequest { FullName = "ShouldNotPersist", Email = "atomic1@example.com", PhoneNumber = "+970599000010" }));
        var reloaded = await _userManager.FindByIdAsync(u2.Id);
        Assert.Equal(originalName, reloaded!.FullName);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }
}
