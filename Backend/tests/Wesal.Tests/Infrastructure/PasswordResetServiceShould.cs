using Microsoft.AspNetCore.DataProtection;
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

public class PasswordResetServiceShould : IDisposable
{
    private readonly ServiceProvider _serviceProvider;
    private readonly PasswordResetService _passwordResetService;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly CapturingResetLinkSender _sender;
    private readonly ApplicationDbContext _context;

    public PasswordResetServiceShould()
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseInMemoryDatabase(Guid.NewGuid().ToString()));
        services.AddDataProtection();
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
        services.Configure<PasswordResetOptions>(options =>
        {
            options.ResetPageUrl = "http://localhost:3000/reset-password";
        });

        _sender = new CapturingResetLinkSender();
        services.AddScoped<IPasswordResetLinkSender>(_ => _sender);
        services.AddScoped<IPasswordResetService, PasswordResetService>();

        _serviceProvider = services.BuildServiceProvider();
        _context = _serviceProvider.GetRequiredService<ApplicationDbContext>();
        _context.Database.EnsureCreated();

        var roleManager = _serviceProvider.GetRequiredService<RoleManager<ApplicationRole>>();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.RegisteredUser)).GetAwaiter().GetResult();
        roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.HallOwner)).GetAwaiter().GetResult();

        _userManager = _serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        _passwordResetService = _serviceProvider.GetRequiredService<IPasswordResetService>() as PasswordResetService
            ?? throw new InvalidOperationException("PasswordResetService was not registered.");
    }

    [Fact]
    public async Task ForgotPassword_UnregisteredEmail_ThrowsValidationException_WithEmailField()
    {
        var request = new ForgotPasswordRequest { Email = "missing@example.com" };

        var exception = await Assert.ThrowsAsync<ValidationException>(
            () => _passwordResetService.ForgotPasswordAsync(request));

        Assert.True(exception.Errors.ContainsKey("Email"));
        Assert.False(_sender.WasCalled);
    }

    [Fact]
    public async Task ForgotPassword_RegisteredEmail_SendsResetLink_AndReturnsMessage()
    {
        await CreateUserAsync("reset@example.com", "OldPassword123!");
        var request = new ForgotPasswordRequest { Email = "reset@example.com" };

        var response = await _passwordResetService.ForgotPasswordAsync(request);

        Assert.False(string.IsNullOrWhiteSpace(response.Message));
        Assert.Equal("reset@example.com", _sender.SentEmail);
        Assert.Contains("reset-password", _sender.SentLink);
    }

    [Fact]
    public async Task ForgotPassword_SendsLinkContainingEncodedEmailAndToken()
    {
        await CreateUserAsync("reset@example.com", "OldPassword123!");
        var request = new ForgotPasswordRequest { Email = "reset@example.com" };

        await _passwordResetService.ForgotPasswordAsync(request);

        Assert.Contains("email=reset%40example.com", _sender.SentLink);
        Assert.Contains("token=", _sender.SentLink);
    }

    [Fact]
    public async Task ResetPassword_UnknownEmail_ThrowsValidationException_WithEmailField()
    {
        var request = new ResetPasswordRequest
        {
            Email = "missing@example.com",
            Token = "some-token",
            NewPassword = "NewPassword123!",
            ConfirmNewPassword = "NewPassword123!"
        };

        var exception = await Assert.ThrowsAsync<ValidationException>(
            () => _passwordResetService.ResetPasswordAsync(request));

        Assert.True(exception.Errors.ContainsKey("Email"));
    }

    [Fact]
    public async Task ResetPassword_ValidToken_ChangesPassword_OldPasswordRejected()
    {
        const string oldPassword = "OldPassword123!";
        const string newPassword = "NewPassword456!";
        var user = await CreateUserAsync("reset@example.com", oldPassword);

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var request = new ResetPasswordRequest
        {
            Email = "reset@example.com",
            Token = token,
            NewPassword = newPassword,
            ConfirmNewPassword = newPassword
        };

        var response = await _passwordResetService.ResetPasswordAsync(request);

        Assert.False(string.IsNullOrWhiteSpace(response.Message));
        Assert.False(await _userManager.CheckPasswordAsync(user, oldPassword));
        Assert.True(await _userManager.CheckPasswordAsync(user, newPassword));
    }

    [Fact]
    public async Task ResetPassword_InvalidToken_ThrowsValidationException_WithTokenField()
    {
        var user = await CreateUserAsync("reset@example.com", "OldPassword123!");

        var request = new ResetPasswordRequest
        {
            Email = "reset@example.com",
            Token = "invalid-token",
            NewPassword = "NewPassword456!",
            ConfirmNewPassword = "NewPassword456!"
        };

        var exception = await Assert.ThrowsAsync<ValidationException>(
            () => _passwordResetService.ResetPasswordAsync(request));

        Assert.True(exception.Errors.ContainsKey("Token"));
        Assert.False(await _userManager.CheckPasswordAsync(user, "NewPassword456!"));
    }

    [Fact]
    public async Task ResetPassword_SingleUseToken_SecondAttemptFails()
    {
        var user = await CreateUserAsync("reset@example.com", "OldPassword123!");

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);

        var firstRequest = new ResetPasswordRequest
        {
            Email = "reset@example.com",
            Token = token,
            NewPassword = "NewPassword456!",
            ConfirmNewPassword = "NewPassword456!"
        };

        await _passwordResetService.ResetPasswordAsync(firstRequest);

        var secondRequest = new ResetPasswordRequest
        {
            Email = "reset@example.com",
            Token = token,
            NewPassword = "AnotherPassword789!",
            ConfirmNewPassword = "AnotherPassword789!"
        };

        var exception = await Assert.ThrowsAsync<ValidationException>(
            () => _passwordResetService.ResetPasswordAsync(secondRequest));

        Assert.True(exception.Errors.ContainsKey("Token"));
        Assert.False(await _userManager.CheckPasswordAsync(user, "AnotherPassword789!"));
    }

    [Fact]
    public async Task ResetPassword_WeakNewPassword_ThrowsValidationException_WithNewPasswordField()
    {
        var user = await CreateUserAsync("reset@example.com", "OldPassword123!");

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var request = new ResetPasswordRequest
        {
            Email = "reset@example.com",
            Token = token,
            NewPassword = "weak",
            ConfirmNewPassword = "weak"
        };

        var exception = await Assert.ThrowsAsync<ValidationException>(
            () => _passwordResetService.ResetPasswordAsync(request));

        Assert.True(exception.Errors.ContainsKey("NewPassword"));
        Assert.False(await _userManager.CheckPasswordAsync(user, "weak"));
    }

    private async Task<ApplicationUser> CreateUserAsync(string email, string password)
    {
        var user = new ApplicationUser
        {
            FullName = "Reset User",
            Email = email,
            UserName = email,
            PhoneNumber = "+972599001122"
        };

        var result = await _userManager.CreateAsync(user, password);
        Assert.True(result.Succeeded);

        return user;
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _serviceProvider.Dispose();
    }

    private sealed class CapturingResetLinkSender : IPasswordResetLinkSender
    {
        public bool WasCalled { get; private set; }

        public string? SentEmail { get; private set; }

        public string? SentLink { get; private set; }

        public Task SendResetLinkAsync(string email, string resetLink, CancellationToken cancellationToken = default)
        {
            WasCalled = true;
            SentEmail = email;
            SentLink = resetLink;
            return Task.CompletedTask;
        }
    }
}