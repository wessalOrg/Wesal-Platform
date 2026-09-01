using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Auth;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;

namespace Wesal.Tests.Infrastructure;

public class RegistrationFinalizationShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly AuthService _authService;
    private readonly UserManager<ApplicationUser> _userManager;

    public RegistrationFinalizationShould()
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
        services.AddScoped<ITokenService, TokenService>();
        services.Configure<JwtSettings>(o =>
        {
            o.SecretKey = "TestSecretKeyForTestingPurposesOnly12345";
            o.Issuer = "WesalAPI";
            o.Audience = "WesalClients";
            o.ExpirationMinutes = 60;
            o.ClockSkewMinutes = 5;
        });
        _provider = services.BuildServiceProvider();
        _context = _provider.GetRequiredService<ApplicationDbContext>();
        _context.Database.EnsureCreated();
        var roleManager = _provider.GetRequiredService<RoleManager<ApplicationRole>>();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.RegisteredUser)).GetAwaiter().GetResult();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.HallOwner)).GetAwaiter().GetResult();
        _userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
        var tokenService = _provider.GetRequiredService<ITokenService>();
        var roleManager2 = _provider.GetRequiredService<RoleManager<ApplicationRole>>();
        _authService = new AuthService(_userManager, roleManager2, tokenService);
    }

    [Fact]
    public async Task ValidRegistration_CreatesExactlyOneUserWithCorrectData()
    {
        var request = new RegisterRequest("Final Test", "final@example.com", "+972599111222", "Password123!", "Password123!", ApplicationRoles.RegisteredUser);
        var countBefore = await _context.Users.CountAsync();
        var response = await _authService.RegisterAsync(request);
        var countAfter = await _context.Users.CountAsync();

        Assert.Equal(countBefore + 1, countAfter);
        Assert.Equal("Final Test", response.FullName);
        Assert.Equal("final@example.com", response.Email);
        Assert.Equal("+972599111222", response.PhoneNumber);
        Assert.Equal(ApplicationRoles.RegisteredUser, response.AccountType);
        Assert.Equal(ApplicationRoles.RegisteredUser, response.Role);
        Assert.False(string.IsNullOrWhiteSpace(response.Id));
        Assert.False(string.IsNullOrWhiteSpace(response.Token));

        var user = await _context.Users.SingleAsync(u => u.Email == "final@example.com");
        Assert.Equal("Final Test", user.FullName);
        Assert.Equal("+972599111222", user.PhoneNumber);
        var roles = await _userManager.GetRolesAsync(user);
        Assert.Contains(ApplicationRoles.RegisteredUser, roles);
    }

    [Fact]
    public async Task ValidHallOwner_PersistedCorrectly()
    {
        var request = new RegisterRequest("Owner Final", "ownerfinal@example.com", "+972599333444", "Password123!", "Password123!", ApplicationRoles.HallOwner);
        var response = await _authService.RegisterAsync(request);
        Assert.Equal(ApplicationRoles.HallOwner, response.AccountType);
        Assert.Equal(ApplicationRoles.HallOwner, response.Role);
        var user = await _userManager.FindByEmailAsync("ownerfinal@example.com");
        Assert.NotNull(user);
        var roles = await _userManager.GetRolesAsync(user);
        Assert.Contains(ApplicationRoles.HallOwner, roles);
    }

    [Fact]
    public async Task Password_StoredSecurely_NotPlainText()
    {
        var request = new RegisterRequest("Secure", "securefinal@example.com", "+972599555666", "Password123!", "Password123!", ApplicationRoles.RegisteredUser);
        await _authService.RegisterAsync(request);
        var user = await _userManager.FindByEmailAsync("securefinal@example.com");
        Assert.NotNull(user);
        Assert.NotNull(user.PasswordHash);
        Assert.NotEqual("Password123!", user.PasswordHash);
        Assert.True(await _userManager.CheckPasswordAsync(user, "Password123!"));
    }

    [Fact]
    public async Task SuccessResponse_DoesNotExposePassword()
    {
        var request = new RegisterRequest("NoLeak", "noleak@example.com", "+972599777888", "Password123!", "Password123!", ApplicationRoles.RegisteredUser);
        var response = await _authService.RegisterAsync(request);
        // Response should not contain password properties
        var json = System.Text.Json.JsonSerializer.Serialize(response);
        Assert.DoesNotContain("Password123!", json);
        Assert.DoesNotContain("PasswordHash", json);
    }

    [Fact]
    public async Task DuplicateRegistration_SameRequest_CannotCreateDuplicate()
    {
        var request = new RegisterRequest("Dup Test", "dupfinal@example.com", "+972599999000", "Password123!", "Password123!", ApplicationRoles.RegisteredUser);
        var first = await _authService.RegisterAsync(request);
        Assert.NotNull(first);

        await Assert.ThrowsAsync<ConflictException>(() => _authService.RegisterAsync(request));
        var count = await _context.Users.CountAsync(u => u.Email == "dupfinal@example.com");
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task DuplicateEmail_RemainsRejected()
    {
        var r1 = new RegisterRequest("User1", "dupemail@example.com", "+972599111333", "Password123!", "Password123!", ApplicationRoles.RegisteredUser);
        await _authService.RegisterAsync(r1);
        var r2 = new RegisterRequest("User2", "dupemail@example.com", "+972599222444", "Password123!", "Password123!", ApplicationRoles.HallOwner);
        await Assert.ThrowsAsync<ConflictException>(() => _authService.RegisterAsync(r2));
    }

    [Fact]
    public async Task DuplicatePhone_RemainsRejected()
    {
        var r1 = new RegisterRequest("User1", "phone1@example.com", "+972599333555", "Password123!", "Password123!", ApplicationRoles.RegisteredUser);
        await _authService.RegisterAsync(r1);
        var r2 = new RegisterRequest("User2", "phone2@example.com", "+972599333555", "Password123!", "Password123!", ApplicationRoles.HallOwner);
        await Assert.ThrowsAsync<ConflictException>(() => _authService.RegisterAsync(r2));
    }

    [Fact]
    public async Task FailedCreation_DoesNotReturnSuccess_And_NoIncompleteUser()
    {
        var countBefore = await _context.Users.CountAsync();
        var badRequest = new RegisterRequest("Bad", "badfail@example.com", "+972599444666", "weak", "weak", ApplicationRoles.RegisteredUser);
        await Assert.ThrowsAsync<ValidationException>(() => _authService.RegisterAsync(badRequest));
        var countAfter = await _context.Users.CountAsync();
        Assert.Equal(countBefore, countAfter);
        var user = await _userManager.FindByEmailAsync("badfail@example.com");
        Assert.Null(user);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }
}
