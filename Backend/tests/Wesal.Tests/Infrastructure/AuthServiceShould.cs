using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
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
    private const string TestFrontendUrl = "https://wesal.test";

    private readonly ServiceProvider _serviceProvider;
    private readonly AuthService _authService;
    private readonly FakeEmailService _emailService;
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
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddDefaultTokenProviders();

        services.AddLogging();
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

        // Seed roles
        var roleManager = _serviceProvider.GetRequiredService<RoleManager<ApplicationRole>>();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.RegisteredUser)).GetAwaiter().GetResult();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.HallOwner)).GetAwaiter().GetResult();

        _userManager = _serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var tokenService = _serviceProvider.GetRequiredService<ITokenService>();
        _emailService = new FakeEmailService();
        _authService = new AuthService(
            _userManager,
            roleManager,
            tokenService,
            _emailService,
            Options.Create(new PasswordResetOptions { FrontendBaseUrl = TestFrontendUrl }),
            NullLogger<AuthService>.Instance);
    }

    [Fact]
    public async Task Register_Valid_RegularUser_Succeeds()
    {
        var request = new RegisterRequest("John Doe", "john@example.com", "Password123!", "Password123!", ApplicationRoles.RegisteredUser);
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
        var request = new RegisterRequest("Owner Name", "owner@example.com", "Password123!", "Password123!", ApplicationRoles.HallOwner);
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
        var request1 = new RegisterRequest("User One", "dup@example.com", "Password123!", "Password123!", ApplicationRoles.RegisteredUser);
        await _authService.RegisterAsync(request1);

        var request2 = new RegisterRequest("User Two", "dup@example.com", "Password123!", "Password123!", ApplicationRoles.RegisteredUser);
        await Assert.ThrowsAsync<ConflictException>(() => _authService.RegisterAsync(request2));

        var count = await _context.Users.CountAsync(u => u.Email == "dup@example.com");
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task Register_WithoutPhone_StoresNullPhone()
    {
        var request1 = new RegisterRequest("User One", "nophone1@example.com", "Password123!", "Password123!", ApplicationRoles.RegisteredUser);
        await _authService.RegisterAsync(request1);

        var request2 = new RegisterRequest("User Two", "nophone2@example.com", "Password123!", "Password123!", ApplicationRoles.RegisteredUser);
        await _authService.RegisterAsync(request2);

        var user = await _userManager.FindByEmailAsync("nophone1@example.com");
        Assert.NotNull(user);
        Assert.Null(user.PhoneNumber);
    }

    [Fact]
    public async Task Register_Password_Mismatch_Rejected()
    {
        var request = new RegisterRequest("Test User", "mismatch@example.com", "Password123!", "Different123!", ApplicationRoles.RegisteredUser);
        await Assert.ThrowsAsync<ValidationException>(() => _authService.RegisterAsync(request));

        var user = await _userManager.FindByEmailAsync("mismatch@example.com");
        Assert.Null(user);
    }

    [Fact]
    public async Task Register_Invalid_AccountType_Rejected()
    {
        var request = new RegisterRequest("Test User", "invalidtype@example.com", "Password123!", "Password123!", "InvalidRole");
        await Assert.ThrowsAsync<ValidationException>(() => _authService.RegisterAsync(request));

        var user = await _userManager.FindByEmailAsync("invalidtype@example.com");
        Assert.Null(user);
    }

    [Fact]
    public async Task Register_Invalid_DoesNotCreateUser()
    {
        var countBefore = await _context.Users.CountAsync();
        var request = new RegisterRequest("", "bademail", "short", "short", ApplicationRoles.RegisteredUser);
        // This will be caught by validator in controller, but service also should handle CreateAsync failure
        // We test service's handling of weak password
        var weakRequest = new RegisterRequest("Test", "testweak@example.com", "weak", "weak", ApplicationRoles.RegisteredUser);
        await Assert.ThrowsAsync<ValidationException>(() => _authService.RegisterAsync(weakRequest));
        var countAfter = await _context.Users.CountAsync();
        Assert.Equal(countBefore, countAfter);
    }

    [Fact]
    public async Task Register_Password_NotStoredAsPlainText()
    {
        var request = new RegisterRequest("Secure User", "secure@example.com", "Password123!", "Password123!", ApplicationRoles.RegisteredUser);
        await _authService.RegisterAsync(request);

        var user = await _userManager.FindByEmailAsync("secure@example.com");
        Assert.NotNull(user);
        Assert.NotNull(user.PasswordHash);
        Assert.NotEqual("Password123!", user.PasswordHash);
        Assert.True(user.PasswordHash.Length > 20);
    }

    [Fact]
    public async Task Register_Persists_FullName_Email_AccountType()
    {
        var request = new RegisterRequest("Persist Test", "persist@example.com", "Password123!", "Password123!", ApplicationRoles.HallOwner);
        var response = await _authService.RegisterAsync(request);

        Assert.Equal("Persist Test", response.FullName);
        Assert.Equal("persist@example.com", response.Email);
        Assert.Equal(ApplicationRoles.HallOwner, response.AccountType);

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == "persist@example.com");
        Assert.NotNull(user);
        Assert.Equal("Persist Test", user.FullName);
        Assert.Null(user.PhoneNumber);
    }

    [Fact]
    public async Task ForgotPassword_RegisteredEmail_SendsResetLinkWithToken()
    {
        await RegisterUserAsync("reset-me@example.com");
        _emailService.Clear();

        var response = await _authService.ForgotPasswordAsync(
            new ForgotPasswordRequest { Email = "reset-me@example.com" });

        Assert.Equal("If an account exists for that email, a password reset link has been sent.", response.Message);

        var sent = Assert.Single(_emailService.Sent);
        Assert.Equal("reset-me@example.com", sent.To);
        Assert.Contains(TestFrontendUrl + "/reset-password", sent.Body);
        Assert.Contains("token=", sent.Body);
        Assert.NotEmpty(ExtractResetToken(sent.Body));
    }

    [Fact]
    public async Task ForgotPassword_UnknownEmail_DoesNotRevealAccountExistence()
    {
        var response = await _authService.ForgotPasswordAsync(
            new ForgotPasswordRequest { Email = "nobody@example.com" });

        Assert.Equal("If an account exists for that email, a password reset link has been sent.", response.Message);
        Assert.Empty(_emailService.Sent);
    }

    [Fact]
    public async Task ForgotPassword_SmtpUnavailable_StillReturnsGenericSuccess()
    {
        await RegisterUserAsync("smtp-down@example.com");
        _emailService.FailSends = true;

        var response = await _authService.ForgotPasswordAsync(
            new ForgotPasswordRequest { Email = "smtp-down@example.com" });

        Assert.Equal("If an account exists for that email, a password reset link has been sent.", response.Message);
    }

    [Fact]
    public async Task ResetPassword_ValidToken_ChangesPassword()
    {
        await RegisterUserAsync("reset-ok@example.com");
        var token = await RequestResetTokenAsync("reset-ok@example.com");

        var response = await _authService.ResetPasswordAsync(new ResetPasswordRequest
        {
            Email = "reset-ok@example.com",
            Token = token,
            NewPassword = "NewPassword456!",
            ConfirmPassword = "NewPassword456!"
        });

        Assert.Contains("reset", response.Message, StringComparison.OrdinalIgnoreCase);

        var user = await _userManager.FindByEmailAsync("reset-ok@example.com");
        Assert.NotNull(user);
        Assert.True(await _userManager.CheckPasswordAsync(user, "NewPassword456!"));
        Assert.False(await _userManager.CheckPasswordAsync(user, "Password123!"));
    }

    [Fact]
    public async Task ResetPassword_InvalidToken_Fails()
    {
        await RegisterUserAsync("reset-badtoken@example.com");

        var exception = await Assert.ThrowsAsync<ValidationException>(() =>
            _authService.ResetPasswordAsync(new ResetPasswordRequest
            {
                Email = "reset-badtoken@example.com",
                Token = "not-a-valid-token",
                NewPassword = "NewPassword456!",
                ConfirmPassword = "NewPassword456!"
            }));

        Assert.Contains("Token", exception.Errors.Keys);
    }

    [Fact]
    public async Task ResetPassword_UnknownEmail_Fails()
    {
        var exception = await Assert.ThrowsAsync<ValidationException>(() =>
            _authService.ResetPasswordAsync(new ResetPasswordRequest
            {
                Email = "missing@example.com",
                Token = "token",
                NewPassword = "NewPassword456!",
                ConfirmPassword = "NewPassword456!"
            }));

        Assert.Contains("Token", exception.Errors.Keys);
    }

    [Fact]
    public async Task ResetPassword_PasswordMismatch_Rejected()
    {
        await RegisterUserAsync("reset-mismatch@example.com");
        var token = await RequestResetTokenAsync("reset-mismatch@example.com");

        var exception = await Assert.ThrowsAsync<ValidationException>(() =>
            _authService.ResetPasswordAsync(new ResetPasswordRequest
            {
                Email = "reset-mismatch@example.com",
                Token = token,
                NewPassword = "NewPassword456!",
                ConfirmPassword = "Different456!"
            }));

        Assert.Contains("ConfirmPassword", exception.Errors.Keys);
    }

    [Fact]
    public async Task ResetPassword_WeakPassword_Rejected()
    {
        await RegisterUserAsync("reset-weak@example.com");
        var token = await RequestResetTokenAsync("reset-weak@example.com");

        var exception = await Assert.ThrowsAsync<ValidationException>(() =>
            _authService.ResetPasswordAsync(new ResetPasswordRequest
            {
                Email = "reset-weak@example.com",
                Token = token,
                NewPassword = "weakpass",
                ConfirmPassword = "weakpass"
            }));

        Assert.Contains("NewPassword", exception.Errors.Keys);
    }

    [Fact]
    public async Task ResetPassword_TokenCannotBeReused()
    {
        await RegisterUserAsync("reset-once@example.com");
        var token = await RequestResetTokenAsync("reset-once@example.com");

        await _authService.ResetPasswordAsync(new ResetPasswordRequest
        {
            Email = "reset-once@example.com",
            Token = token,
            NewPassword = "NewPassword456!",
            ConfirmPassword = "NewPassword456!"
        });

        await Assert.ThrowsAsync<ValidationException>(() =>
            _authService.ResetPasswordAsync(new ResetPasswordRequest
            {
                Email = "reset-once@example.com",
                Token = token,
                NewPassword = "AnotherPass789!",
                ConfirmPassword = "AnotherPass789!"
            }));
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _serviceProvider.Dispose();
    }

    private async Task RegisterUserAsync(string email)
    {
        await _authService.RegisterAsync(new RegisterRequest(
            "Reset Tester",
            email,
            "Password123!",
            "Password123!",
            ApplicationRoles.RegisteredUser));
    }

    private async Task<string> RequestResetTokenAsync(string email)
    {
        _emailService.Clear();
        await _authService.ForgotPasswordAsync(new ForgotPasswordRequest { Email = email });
        var sent = Assert.Single(_emailService.Sent);
        return ExtractResetToken(sent.Body);
    }

    private static string ExtractResetToken(string body)
    {
        var marker = "token=";
        var start = body.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        Assert.True(start >= 0, "Reset email body must contain the token.");
        var valueStart = start + marker.Length;
        var lineEnd = body.IndexOf('\n', valueStart);
        var encoded = lineEnd < 0
            ? body[valueStart..]
            : body[valueStart..lineEnd];
        return Uri.UnescapeDataString(encoded.Trim());
    }

    private sealed class FakeEmailService : IEmailService
    {
        public List<EmailRecord> Sent { get; } = [];

        public bool FailSends { get; set; }

        public void Clear() => Sent.Clear();

        public Task<bool> TrySendAsync(
            string to,
            string subject,
            string body,
            CancellationToken cancellationToken = default)
        {
            if (!FailSends)
            {
                Sent.Add(new EmailRecord(to, subject, body));
            }

            return Task.FromResult(!FailSends);
        }

        public sealed record EmailRecord(string To, string Subject, string Body);
    }
}
