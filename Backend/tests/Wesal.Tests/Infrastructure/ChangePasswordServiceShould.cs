using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Auth;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Profile;
using Wesal.Persistence.Data;

namespace Wesal.Tests.Infrastructure;

public class ChangePasswordServiceShould : IDisposable
{
    private readonly ServiceProvider _serviceProvider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ITokenService _tokenService;

    public ChangePasswordServiceShould()
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
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddDefaultTokenProviders();

        services.AddDataProtection();
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

        _userManager = _serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        _tokenService = _serviceProvider.GetRequiredService<ITokenService>();
    }

    [Fact]
    public async Task ChangePassword_SameAsCurrentPassword_Rejected()
    {
        var user = await CreateUserAsync("sameascurrent@example.com", "Password123!");
        var service = CreateProfileService(user.Id, authenticated: true);

        var exception = await Assert.ThrowsAsync<ValidationException>(() =>
            service.ChangePasswordAsync(new ChangePasswordRequest
            {
                CurrentPassword = "Password123!",
                NewPassword = "Password123!",
                ConfirmPassword = "Password123!"
            }));

        Assert.Contains("NewPassword", exception.Errors.Keys);
        Assert.True(await _userManager.CheckPasswordAsync(user, "Password123!"));
    }

    [Fact]
    public async Task ChangePassword_WrongCurrentPassword_RejectsWithCurrentPasswordField()
    {
        var user = await CreateUserAsync("wrongcurrent@example.com", "Password123!");
        var service = CreateProfileService(user.Id, authenticated: true);

        var exception = await Assert.ThrowsAsync<ValidationException>(() =>
            service.ChangePasswordAsync(new ChangePasswordRequest
            {
                CurrentPassword = "WrongCurrent|1234",
                NewPassword = "NewPassword456!",
                ConfirmPassword = "NewPassword456!"
            }));

        Assert.Contains("CurrentPassword", exception.Errors.Keys);
        Assert.True(await _userManager.CheckPasswordAsync(user, "Password123!"));
    }

    [Fact]
    public async Task ChangePassword_NewEqualsConfirm_ButCurrentInvalid_RejectsWithCurrentPasswordField()
    {
        var user = await CreateUserAsync("currentinvalid@example.com", "Password123!");
        var service = CreateProfileService(user.Id, authenticated: true);

        var exception = await Assert.ThrowsAsync<ValidationException>(() =>
            service.ChangePasswordAsync(new ChangePasswordRequest
            {
                CurrentPassword = "Nope999999",
                NewPassword = "NewPassword456!",
                ConfirmPassword = "NewPassword456!"
            }));

        Assert.Contains("CurrentPassword", exception.Errors.Keys);
    }

    [Fact]
    public async Task ChangePassword_WeakNewPassword_RejectsWithNewPasswordField()
    {
        var user = await CreateUserAsync("weaknew@example.com", "Password123!");
        var service = CreateProfileService(user.Id, authenticated: true);

        var exception = await Assert.ThrowsAsync<ValidationException>(() =>
            service.ChangePasswordAsync(new ChangePasswordRequest
            {
                CurrentPassword = "Password123!",
                NewPassword = "short",
                ConfirmPassword = "short"
            }));

        Assert.Contains("NewPassword", exception.Errors.Keys);
        Assert.True(await _userManager.CheckPasswordAsync(user, "Password123!"));
    }

    [Fact]
    public async Task ChangePassword_AllDifferentCurrentNewConfirm_RejectsWithConfirmPasswordField()
    {
        var user = await CreateUserAsync("alldifferent@example.com", "Password123!");
        var service = CreateProfileService(user.Id, authenticated: true);

        var exception = await Assert.ThrowsAsync<ValidationException>(() =>
            service.ChangePasswordAsync(new ChangePasswordRequest
            {
                CurrentPassword = "Password123!",
                NewPassword = "NewPassword456!",
                ConfirmPassword = "AnotherPass789!"
            }));

        Assert.Contains("ConfirmPassword", exception.Errors.Keys);
    }

    [Fact]
    public async Task ChangePassword_ConfirmMismatch_RejectsWithConfirmPasswordField()
    {
        var user = await CreateUserAsync("confirmmismatch@example.com", "Password123!");
        var service = CreateProfileService(user.Id, authenticated: true);

        var exception = await Assert.ThrowsAsync<ValidationException>(() =>
            service.ChangePasswordAsync(new ChangePasswordRequest
            {
                CurrentPassword = "Password123!",
                NewPassword = "NewPassword456!",
                ConfirmPassword = "NewPassword457!"
            }));

        Assert.Contains("ConfirmPassword", exception.Errors.Keys);
    }

    [Fact]
    public async Task ChangePassword_CorrectCurrent_UpdatesPassword_OldFails_NewWorks()
    {
        var user = await CreateUserAsync("updateok@example.com", "Password123!");
        var service = CreateProfileService(user.Id, authenticated: true);
        var loginService = CreateLoginService();

        var response = await service.ChangePasswordAsync(new ChangePasswordRequest
        {
            CurrentPassword = "Password123!",
            NewPassword = "NewPassword456!",
            ConfirmPassword = "NewPassword456!"
        });

        Assert.False(string.IsNullOrWhiteSpace(response.Message));

        Assert.True(await _userManager.CheckPasswordAsync(user, "NewPassword456!"));
        Assert.False(await _userManager.CheckPasswordAsync(user, "Password123!"));

        await Assert.ThrowsAsync<ValidationException>(() =>
            loginService.LoginAsync(new LoginRequest { Email = "updateok@example.com", Password = "Password123!" }));

        var login = await loginService.LoginAsync(new LoginRequest { Email = "updateok@example.com", Password = "NewPassword456!" });
        Assert.Equal("updateok@example.com", login.Email);
        Assert.False(string.IsNullOrWhiteSpace(login.Token));
    }

    [Fact]
    public async Task ChangePassword_ForDifferentUser_RejectsTheirCurrentPassword()
    {
        var userA = await CreateUserAsync("diff-a@example.com", "Password123!");
        var userB = await CreateUserAsync("diff-b@example.com", "MySecret098!");
        var service = CreateProfileService(userA.Id, authenticated: true);

        var exception = await Assert.ThrowsAsync<ValidationException>(() =>
            service.ChangePasswordAsync(new ChangePasswordRequest
            {
                CurrentPassword = "MySecret098!",
                NewPassword = "NewPassword456!",
                ConfirmPassword = "NewPassword456!"
            }));

        Assert.Contains("CurrentPassword", exception.Errors.Keys);
        Assert.True(await _userManager.CheckPasswordAsync(userB, "MySecret098!"));
    }

    [Fact]
    public async Task ChangePassword_DoesNotChangeOtherUsersPassword()
    {
        var userA = await CreateUserAsync("iso-a@example.com", "Password123!");
        var userB = await CreateUserAsync("iso-b@example.com", "MySecret098!");
        var service = CreateProfileService(userA.Id, authenticated: true);

        await service.ChangePasswordAsync(new ChangePasswordRequest
        {
            CurrentPassword = "Password123!",
            NewPassword = "NewPassword456!",
            ConfirmPassword = "NewPassword456!"
        });

        Assert.False(await _userManager.CheckPasswordAsync(userA, "Password123!"));
        Assert.True(await _userManager.CheckPasswordAsync(userA, "NewPassword456!"));
        Assert.True(await _userManager.CheckPasswordAsync(userB, "MySecret098!"));
    }

    [Fact]
    public async Task ChangePassword_NewPassword_NotStoredAsPlainText()
    {
        var user = await CreateUserAsync("hashed@example.com", "Password123!");
        var service = CreateProfileService(user.Id, authenticated: true);

        await service.ChangePasswordAsync(new ChangePasswordRequest
        {
            CurrentPassword = "Password123!",
            NewPassword = "NewPassword456!",
            ConfirmPassword = "NewPassword456!"
        });

        var reloaded = await _userManager.FindByIdAsync(user.Id);
        Assert.NotNull(reloaded);
        Assert.NotNull(reloaded.PasswordHash);
        Assert.NotEqual("NewPassword456!", reloaded.PasswordHash);
        Assert.True(reloaded.PasswordHash.Length > 20);
    }

    [Fact]
    public async Task ChangePassword_UnauthenticatedUser_Rejected()
    {
        var service = CreateProfileService(userId: null, authenticated: false);

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.ChangePasswordAsync(new ChangePasswordRequest
            {
                CurrentPassword = "Password123!",
                NewPassword = "NewPassword456!",
                ConfirmPassword = "NewPassword456!"
            }));
    }

    [Fact]
    public async Task ChangePassword_UnknownCurrentUser_Rejected()
    {
        var service = CreateProfileService("user-does-not-exist", authenticated: true);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.ChangePasswordAsync(new ChangePasswordRequest
            {
                CurrentPassword = "Password123!",
                NewPassword = "NewPassword456!",
                ConfirmPassword = "NewPassword456!"
            }));
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _serviceProvider.Dispose();
    }

    private async Task<ApplicationUser> CreateUserAsync(string email, string password)
    {
        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            FullName = "Change Password Tester"
        };
        var result = await _userManager.CreateAsync(user, password);
        Assert.True(result.Succeeded, string.Join("; ", result.Errors.Select(e => e.Description)));
        return user;
    }

    private ProfileService CreateProfileService(string? userId, bool authenticated)
        => new(_userManager, new FakeCurrentUser(userId, authenticated));

    private LoginService CreateLoginService()
        => new(_userManager, _tokenService, new FakeDateTime());

    private sealed class FakeCurrentUser : ICurrentUserService
    {
        public FakeCurrentUser(string? userId, bool authenticated)
        {
            UserId = userId;
            IsAuthenticated = authenticated;
        }

        public string? UserId { get; }
        public string? UserName => "test";
        public string? Email => "test@example.com";
        public bool IsAuthenticated { get; }
        public IReadOnlyList<string> Roles { get; } = [];
    }

    private sealed class FakeDateTime : IDateTime
    {
        public DateTimeOffset Now => DateTimeOffset.UtcNow;
    }
}