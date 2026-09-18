using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Domain.Constants;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Profile;
using Wesal.Persistence.Data;
using Wesal.Application.Common.Models;

namespace Wesal.Tests.Infrastructure;

public class HallOwnerProfileServiceShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;

    public HallOwnerProfileServiceShould()
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

    private async Task<ApplicationUser> CreateHallOwnerAsync(string email, string phone, string fullName = "Hall Owner")
    {
        var user = new ApplicationUser { FullName = fullName, Email = email, UserName = email, PhoneNumber = phone };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded) throw new Exception(string.Join(",", result.Errors.Select(e => e.Description)));
        await _userManager.AddToRoleAsync(user, ApplicationRoles.HallOwner);
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
    public async Task HallOwner_CanRetrieveOwnProfile()
    {
        var user = await CreateHallOwnerAsync("hallowner@example.com", "+970599111111");
        var service = new ProfileService(_userManager, new FakeCurrentUser(user.Id, true, ApplicationRoles.HallOwner));
        var result = await service.GetProfileAsync();
        Assert.Equal("hallowner@example.com", result.Email);
        Assert.Equal("+970599111111", result.PhoneNumber);
        Assert.Equal(user.FullName, result.FullName);
        Assert.False(string.IsNullOrWhiteSpace(result.ConcurrencyStamp));
    }

    [Fact]
    public async Task HallOwner_RetrievedProfile_ContainsPermittedFieldsOnly()
    {
        var user = await CreateHallOwnerAsync("hallowner2@example.com", "+970599222222");
        var service = new ProfileService(_userManager, new FakeCurrentUser(user.Id, true, ApplicationRoles.HallOwner));
        var result = await service.GetProfileAsync();
        var json = System.Text.Json.JsonSerializer.Serialize(result);
        Assert.DoesNotContain("Password", json);
        Assert.DoesNotContain("Token", json);
        Assert.Contains("FullName", json);
        Assert.Contains("Email", json);
        Assert.Contains("PhoneNumber", json);
    }

    [Fact]
    public async Task HallOwner_CanUpdateName()
    {
        var user = await CreateHallOwnerAsync("updatename@example.com", "+970599333333");
        var service = new ProfileService(_userManager, new FakeCurrentUser(user.Id, true, ApplicationRoles.HallOwner));
        var updated = await service.UpdateProfileAsync(new UpdateProfileRequest { FullName = "New Hall Owner Name", Email = "updatename@example.com", PhoneNumber = "+970599333333", ConcurrencyStamp = user.ConcurrencyStamp });
        Assert.Equal("New Hall Owner Name", updated.FullName);
        var reloaded = await _userManager.FindByIdAsync(user.Id);
        Assert.Equal("New Hall Owner Name", reloaded!.FullName);
    }

    [Fact]
    public async Task HallOwner_CanUpdatePhone()
    {
        var user = await CreateHallOwnerAsync("updatephone@example.com", "+970599444444");
        var service = new ProfileService(_userManager, new FakeCurrentUser(user.Id, true, ApplicationRoles.HallOwner));
        var updated = await service.UpdateProfileAsync(new UpdateProfileRequest { FullName = user.FullName, Email = "updatephone@example.com", PhoneNumber = "+970599555555", ConcurrencyStamp = user.ConcurrencyStamp });
        Assert.Equal("+970599555555", updated.PhoneNumber);
    }

    [Fact]
    public async Task HallOwner_CanUpdateEmail()
    {
        var user = await CreateHallOwnerAsync("oldemail@example.com", "+970599666666");
        var service = new ProfileService(_userManager, new FakeCurrentUser(user.Id, true, ApplicationRoles.HallOwner));
        var updated = await service.UpdateProfileAsync(new UpdateProfileRequest { FullName = user.FullName, Email = "newemail@example.com", PhoneNumber = "+970599666666", ConcurrencyStamp = user.ConcurrencyStamp });
        Assert.Equal("newemail@example.com", updated.Email);
    }

    [Fact]
    public async Task HallOwner_Update_PersistedAndRetrieved()
    {
        var user = await CreateHallOwnerAsync("persist@example.com", "+970599777777");
        var service = new ProfileService(_userManager, new FakeCurrentUser(user.Id, true, ApplicationRoles.HallOwner));
        await service.UpdateProfileAsync(new UpdateProfileRequest { FullName = "Persisted", Email = "persist2@example.com", PhoneNumber = "+970599888888", ConcurrencyStamp = user.ConcurrencyStamp });
        var retrieved = await service.GetProfileAsync();
        Assert.Equal("Persisted", retrieved.FullName);
        Assert.Equal("persist2@example.com", retrieved.Email);
        Assert.Equal("+970599888888", retrieved.PhoneNumber);
    }

    [Fact]
    public async Task HallOwner_CannotUpdateAnotherUsersProfile()
    {
        var victim = await CreateHallOwnerAsync("victim@example.com", "+970599000001");
        var attacker = await CreateHallOwnerAsync("attacker@example.com", "+970599000002");
        var service = new ProfileService(_userManager, new FakeCurrentUser(attacker.Id, true, ApplicationRoles.HallOwner));
        var updated = await service.UpdateProfileAsync(new UpdateProfileRequest { FullName = "Hacked", Email = "attacker@example.com", PhoneNumber = "+970599000002", ConcurrencyStamp = attacker.ConcurrencyStamp });
        Assert.Equal("Hacked", updated.FullName);
        var victimReloaded = await _userManager.FindByIdAsync(victim.Id);
        Assert.NotEqual("Hacked", victimReloaded!.FullName);
    }

    [Fact]
    public async Task HallOwner_CannotRetrieveAnotherUsersProfile()
    {
        var victim = await CreateHallOwnerAsync("victim2@example.com", "+970599000003");
        var attacker = await CreateHallOwnerAsync("attacker2@example.com", "+970599000004");
        var service = new ProfileService(_userManager, new FakeCurrentUser(attacker.Id, true, ApplicationRoles.HallOwner));
        var result = await service.GetProfileAsync();
        Assert.Equal("attacker2@example.com", result.Email);
        Assert.NotEqual(victim.Email, result.Email);
    }

    [Fact]
    public async Task HallOwner_InvalidName_Rejected()
    {
        var user = await CreateHallOwnerAsync("invalidname@example.com", "+970599000005");
        var service = new ProfileService(_userManager, new FakeCurrentUser(user.Id, true, ApplicationRoles.HallOwner));
        await Assert.ThrowsAsync<ValidationException>(() => service.UpdateProfileAsync(new UpdateProfileRequest { FullName = "", Email = "invalidname@example.com", PhoneNumber = "+970599000005" }));
    }

    [Fact]
    public async Task HallOwner_DuplicateEmail_Rejected()
    {
        var u1 = await CreateHallOwnerAsync("dup1@example.com", "+970599000006");
        var u2 = await CreateHallOwnerAsync("dup2@example.com", "+970599000007");
        var service = new ProfileService(_userManager, new FakeCurrentUser(u2.Id, true, ApplicationRoles.HallOwner));
        await Assert.ThrowsAsync<ConflictException>(() => service.UpdateProfileAsync(new UpdateProfileRequest { FullName = u2.FullName, Email = "dup1@example.com", PhoneNumber = u2.PhoneNumber! }));
    }

    [Fact]
    public async Task HallOwner_UpdatingOneField_DoesNotOverwriteOthers()
    {
        var user = await CreateHallOwnerAsync("partial@example.com", "+970599000008");
        var originalEmail = user.Email;
        var service = new ProfileService(_userManager, new FakeCurrentUser(user.Id, true, ApplicationRoles.HallOwner));
        var updated = await service.UpdateProfileAsync(new UpdateProfileRequest { FullName = user.FullName, Email = originalEmail!, PhoneNumber = "+970599000009", ConcurrencyStamp = user.ConcurrencyStamp });
        Assert.Equal(originalEmail, updated.Email);
        Assert.Equal("+970599000009", updated.PhoneNumber);
    }

    [Fact]
    public async Task HallOwner_StaleUpdate_Rejected()
    {
        var user = await CreateHallOwnerAsync("stale@example.com", "+970599000010");
        var service1 = new ProfileService(_userManager, new FakeCurrentUser(user.Id, true, ApplicationRoles.HallOwner));
        var profile = await service1.GetProfileAsync();
        var service2 = new ProfileService(_userManager, new FakeCurrentUser(user.Id, true, ApplicationRoles.HallOwner));
        await service2.UpdateProfileAsync(new UpdateProfileRequest { FullName = "Concurrent", Email = "stale@example.com", PhoneNumber = "+970599000010", ConcurrencyStamp = profile.ConcurrencyStamp });
        await Assert.ThrowsAsync<ConflictException>(() => service1.UpdateProfileAsync(new UpdateProfileRequest { FullName = "Stale", Email = "stale@example.com", PhoneNumber = "+970599000010", ConcurrencyStamp = profile.ConcurrencyStamp }));
    }

    [Fact]
    public async Task Unauthenticated_HallOwner_RetrievalRejected()
    {
        var service = new ProfileService(_userManager, new FakeCurrentUser(null, false));
        await Assert.ThrowsAsync<UnauthorizedException>(() => service.GetProfileAsync());
    }

    [Fact]
    public async Task RegularUser_StillWorks_AfterHallOwnerIntegration()
    {
        var user = await CreateHallOwnerAsync("regularcheck@example.com", "+970599000011");
        // Create a regular user and ensure regular flow still works
        var regular = new ApplicationUser { FullName = "Regular", Email = "regularuser@example.com", UserName = "regularuser@example.com", PhoneNumber = "+970599000012" };
        await _userManager.CreateAsync(regular, "Password123!");
        await _userManager.AddToRoleAsync(regular, ApplicationRoles.RegisteredUser);
        var service = new ProfileService(_userManager, new FakeCurrentUser(regular.Id, true, ApplicationRoles.RegisteredUser));
        var result = await service.GetProfileAsync();
        Assert.Equal("regularuser@example.com", result.Email);
        var updated = await service.UpdateProfileAsync(new UpdateProfileRequest { FullName = "Regular Updated", Email = "regularuser@example.com", PhoneNumber = "+970599000012", ConcurrencyStamp = regular.ConcurrencyStamp });
        Assert.Equal("Regular Updated", updated.FullName);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }
}
