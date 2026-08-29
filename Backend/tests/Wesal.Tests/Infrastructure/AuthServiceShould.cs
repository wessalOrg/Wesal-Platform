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

public class AuthServiceShould : IDisposable
{
    private readonly ServiceProvider _serviceProvider;
    private readonly AuthService _authService;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ApplicationDbContext _context;

    public AuthServiceShould()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseInMemoryDatabase(Guid.NewGuid().ToString()));
        services.AddIdentityCore<ApplicationUser>(options =>
            {
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireNonAlphanumeric = true;
                options.Password.RequiredLength = 8;
                options.User.RequireUniqueEmail = true;
            })
            .AddRoles<ApplicationRole>()
            .AddEntityFrameworkStores<ApplicationDbContext>();

        services.AddLogging();
        services.AddScoped<ITokenService, TokenService>();
        services.Configure<JwtSettings>(options =>
        {
            options.SecretKey = "TestSecretKeyForTestingPurposesOnly12345";
            options.Issuer = "WesalAPI";
            options.Audience = "WesalClients";
            options.ExpirationMinutes = 60;
            options.ClockSkewMinutes = 5;
        });

        _serviceProvider = services.BuildServiceProvider();
        _context = _serviceProvider.GetRequiredService<ApplicationDbContext>();
        _context.Database.EnsureCreated();

        // Seed roles
        var roleManager = _serviceProvider.GetRequiredService<RoleManager<ApplicationRole>>();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.RegisteredUser)).GetAwaiter().GetResult();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.HallOwner)).GetAwaiter().GetResult();

        _userManager = _serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var tokenService = _serviceProvider.GetRequiredService<ITokenService>();
        _authService = new AuthService(_userManager, tokenService);
    }

    [Fact]
    public async Task Register_Valid_RegularUser_Succeeds()
    {
        var request = new RegisterRequest("John Doe", "john@example.com", "+972599111111", "Password123!", "Password123!", ApplicationRoles.RegisteredUser);
        var response = await _authService.RegisterAsync(request);

        Assert.NotNull(response);
        Assert.Equal("john@example.com", response.Email);
        Assert.Equal(ApplicationRoles.RegisteredUser, response.AccountType);
        Assert.False(string.IsNullOrWhiteSpace(response.Token));

        var user = await _userManager.FindByEmailAsync("john@example.com");
        Assert.NotNull(user);
        Assert.Equal("John Doe", user.FullName);
        var roles = await _userManager.GetRolesAsync(user);
        Assert.Contains(ApplicationRoles.RegisteredUser, roles);
    }

    [Fact]
    public async Task Register_Valid_HallOwner_Succeeds()
    {
        var request = new RegisterRequest("Owner Name", "owner@example.com", "+972599222222", "Password123!", "Password123!", ApplicationRoles.HallOwner);
        var response = await _authService.RegisterAsync(request);

        Assert.Equal(ApplicationRoles.HallOwner, response.AccountType);
        var user = await _userManager.FindByEmailAsync("owner@example.com");
        Assert.NotNull(user);
        var roles = await _userManager.GetRolesAsync(user);
        Assert.Contains(ApplicationRoles.HallOwner, roles);
    }

    [Fact]
    public async Task Register_Duplicate_Email_Rejected()
    {
        var request1 = new RegisterRequest("User One", "dup@example.com", "+972599333333", "Password123!", "Password123!", ApplicationRoles.RegisteredUser);
        await _authService.RegisterAsync(request1);

        var request2 = new RegisterRequest("User Two", "dup@example.com", "+972599444444", "Password123!", "Password123!", ApplicationRoles.RegisteredUser);
        await Assert.ThrowsAsync<ConflictException>(() => _authService.RegisterAsync(request2));

        var count = await _context.Users.CountAsync(u => u.Email == "dup@example.com");
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task Register_Duplicate_Phone_Rejected()
    {
        var request1 = new RegisterRequest("User One", "user1@example.com", "+972599555555", "Password123!", "Password123!", ApplicationRoles.RegisteredUser);
        await _authService.RegisterAsync(request1);

        var request2 = new RegisterRequest("User Two", "user2@example.com", "+972599555555", "Password123!", "Password123!", ApplicationRoles.RegisteredUser);
        await Assert.ThrowsAsync<ConflictException>(() => _authService.RegisterAsync(request2));

        var count = await _context.Users.CountAsync(u => u.PhoneNumber == "+972599555555");
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task Register_Password_Mismatch_Rejected()
    {
        var request = new RegisterRequest("Test User", "mismatch@example.com", "+972599666666", "Password123!", "Different123!", ApplicationRoles.RegisteredUser);
        await Assert.ThrowsAsync<ValidationException>(() => _authService.RegisterAsync(request));

        var user = await _userManager.FindByEmailAsync("mismatch@example.com");
        Assert.Null(user);
    }

    [Fact]
    public async Task Register_Invalid_AccountType_Rejected()
    {
        var request = new RegisterRequest("Test User", "invalidtype@example.com", "+972599777777", "Password123!", "Password123!", "InvalidRole");
        await Assert.ThrowsAsync<ValidationException>(() => _authService.RegisterAsync(request));

        var user = await _userManager.FindByEmailAsync("invalidtype@example.com");
        Assert.Null(user);
    }

    [Fact]
    public async Task Register_Invalid_DoesNotCreateUser()
    {
        var countBefore = await _context.Users.CountAsync();
        var request = new RegisterRequest("", "bademail", "+972599888888", "short", "short", ApplicationRoles.RegisteredUser);
        // This will be caught by validator in controller, but service also should handle CreateAsync failure
        // We test service's handling of weak password
        var weakRequest = new RegisterRequest("Test", "testweak@example.com", "+972599888888", "weak", "weak", ApplicationRoles.RegisteredUser);
        await Assert.ThrowsAsync<ValidationException>(() => _authService.RegisterAsync(weakRequest));
        var countAfter = await _context.Users.CountAsync();
        Assert.Equal(countBefore, countAfter);
    }

    [Fact]
    public async Task Register_Password_NotStoredAsPlainText()
    {
        var request = new RegisterRequest("Secure User", "secure@example.com", "+972599999999", "Password123!", "Password123!", ApplicationRoles.RegisteredUser);
        await _authService.RegisterAsync(request);

        var user = await _userManager.FindByEmailAsync("secure@example.com");
        Assert.NotNull(user);
        Assert.NotNull(user.PasswordHash);
        Assert.NotEqual("Password123!", user.PasswordHash);
        Assert.True(user.PasswordHash.Length > 20);
    }

    [Fact]
    public async Task Register_Persists_FullName_Email_Phone_AccountType()
    {
        var request = new RegisterRequest("Persist Test", "persist@example.com", "+972599000001", "Password123!", "Password123!", ApplicationRoles.HallOwner);
        var response = await _authService.RegisterAsync(request);

        Assert.Equal("Persist Test", response.FullName);
        Assert.Equal("persist@example.com", response.Email);
        Assert.Equal("+972599000001", response.PhoneNumber);
        Assert.Equal(ApplicationRoles.HallOwner, response.AccountType);

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == "persist@example.com");
        Assert.NotNull(user);
        Assert.Equal("Persist Test", user.FullName);
        Assert.Equal("+972599000001", user.PhoneNumber);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _serviceProvider.Dispose();
    }
}
