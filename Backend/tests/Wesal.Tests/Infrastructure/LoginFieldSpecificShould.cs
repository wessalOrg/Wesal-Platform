using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Auth;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Time;
using Wesal.Persistence.Data;

namespace Wesal.Tests.Infrastructure;

public class LoginFieldSpecificShould
{
    private const string Password = "Password123!";
    private const string SecretKey = "test_signing_key_that_is_at_least_32_characters_long";

    private static (LoginService Login, AuthService Registration, ApplicationDbContext Context) CreateService()
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
            o.Lockout.MaxFailedAccessAttempts = 5;
            o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        }).AddRoles<ApplicationRole>().AddEntityFrameworkStores<ApplicationDbContext>();
        var provider = services.BuildServiceProvider();
        var userManager = provider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = provider.GetRequiredService<RoleManager<ApplicationRole>>();
        var context = provider.GetRequiredService<ApplicationDbContext>();
        var tokenService = new TokenService(Options.Create(new JwtSettings { Issuer = "WesalTests", Audience = "WesalTests", SecretKey = SecretKey, ExpirationMinutes = 30, ClockSkewMinutes = 5 }));
        var login = new LoginService(userManager, tokenService, new DateTimeService());
        var registration = new AuthService(userManager, roleManager, tokenService, NullEmailService.Instance, Options.Create(new PasswordResetOptions()), NullLogger<AuthService>.Instance);
        return (login, registration, context);
    }

    private static RegisterRequest CreateRegister(string email, string type) => new()
    {
        FullName = "Test User",
        Email = email,
        Password = Password,
        ConfirmPassword = Password,
        AccountType = type
    };

    [Fact]
    public async Task UnregisteredEmail_MapsToEmailField()
    {
        var (login, _, _) = CreateService();
        var ex = await Assert.ThrowsAsync<ValidationException>(() => login.LoginAsync(new LoginRequest { Email = "unknown@example.com", Password = Password }));
        Assert.True(ex.Errors.ContainsKey("Email"));
        Assert.DoesNotContain("PasswordHash", ex.Message);
    }

    [Fact]
    public async Task UnregisteredPhoneIdentifier_MapsToEmailField()
    {
        var (login, _, _) = CreateService();
        var ex = await Assert.ThrowsAsync<ValidationException>(() => login.LoginAsync(new LoginRequest { Email = "+970599000000", Password = Password }));
        Assert.True(ex.Errors.ContainsKey("Email"));
    }

    [Fact]
    public async Task CorrectEmail_WrongPassword_MapsToPasswordField()
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(CreateRegister("test@example.com", AccountTypes.RegularUser));
        var ex = await Assert.ThrowsAsync<ValidationException>(() => login.LoginAsync(new LoginRequest { Email = "test@example.com", Password = "WrongPassword1!" }));
        Assert.True(ex.Errors.ContainsKey("Password"));
        Assert.False(ex.Errors.ContainsKey("Email"));
    }

    [Fact]
    public async Task InvalidEmail_Handled()
    {
        var (login, _, _) = CreateService();
        var ex = await Assert.ThrowsAsync<ValidationException>(() => login.LoginAsync(new LoginRequest { Email = "invalid-email@", Password = Password }));
        // Should be treated as email not found, maps to Email
        Assert.True(ex.Errors.ContainsKey("Email"));
    }

    [Fact]
    public async Task FieldSpecific_ResponseFollowsValidationProblemDetailsContract()
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(CreateRegister("fieldtest@example.com", AccountTypes.RegularUser));
        var ex = await Assert.ThrowsAsync<ValidationException>(() => login.LoginAsync(new LoginRequest { Email = "fieldtest@example.com", Password = "WrongPassword1!" }));
        // Ensure errors are structured as ValidationException with field keys
        Assert.NotEmpty(ex.Errors);
        Assert.True(ex.Errors.ContainsKey("Password"));
        // No sensitive data
        var joined = string.Join(" ", ex.Errors.Values.SelectMany(v => v));
        Assert.DoesNotContain("PasswordHash", joined);
        Assert.DoesNotContain("stack", joined, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SuccessfulLogin_StillWorks_WithFieldSpecific()
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(CreateRegister("success@example.com", AccountTypes.RegularUser));
        var response = await login.LoginAsync(new LoginRequest { Email = "success@example.com", Password = Password });
        Assert.False(string.IsNullOrWhiteSpace(response.Token));
        Assert.Equal("success@example.com", response.Email);
    }

    [Fact]
    public async Task RegisterWithoutPhone_LoginByEmail_StillWorks()
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(CreateRegister("nophone@example.com", AccountTypes.RegularUser));
        var response = await login.LoginAsync(new LoginRequest { Email = "nophone@example.com", Password = Password });
        Assert.False(string.IsNullOrWhiteSpace(response.Token));
        Assert.Equal("nophone@example.com", response.Email);
    }
}