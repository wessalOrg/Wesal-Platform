using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
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
        var registration = new AuthService(userManager, roleManager, tokenService);
        return (login, registration, context);
    }

    private static RegisterRequest CreateRegister(string email, string phone, string type) => new()
    {
        FullName = "Test User",
        Email = email,
        PhoneNumber = phone,
        Password = Password,
        ConfirmPassword = Password,
        AccountType = type
    };

    [Fact]
    public async Task UnregisteredEmail_MapsToEmailField()
    {
        var (login, _, _) = CreateService();
        var ex = await Assert.ThrowsAsync<ValidationException>(() => login.LoginAsync(new LoginRequest { Identifier = "unknown@example.com", Password = Password }));
        Assert.True(ex.Errors.ContainsKey("Identifier") || ex.Errors.ContainsKey("Email"));
        Assert.DoesNotContain("PasswordHash", ex.Message);
    }

    [Fact]
    public async Task UnregisteredPhone_MapsToPhoneField()
    {
        var (login, _, _) = CreateService();
        var ex = await Assert.ThrowsAsync<ValidationException>(() => login.LoginAsync(new LoginRequest { Identifier = "+970599000000", Password = Password }));
        Assert.True(ex.Errors.ContainsKey("Identifier") || ex.Errors.ContainsKey("PhoneNumber"));
    }

    [Fact]
    public async Task CorrectEmail_WrongPassword_MapsToPasswordField()
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(CreateRegister("test@example.com", "+970599111111", AccountTypes.RegularUser));
        var ex = await Assert.ThrowsAsync<ValidationException>(() => login.LoginAsync(new LoginRequest { Identifier = "test@example.com", Password = "WrongPassword1!" }));
        Assert.True(ex.Errors.ContainsKey("Password"));
        Assert.False(ex.Errors.ContainsKey("Email"));
    }

    [Fact]
    public async Task CorrectPhone_WrongPassword_MapsToPasswordField()
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(CreateRegister("p2@example.com", "+970599222222", AccountTypes.RegularUser));
        var ex = await Assert.ThrowsAsync<ValidationException>(() => login.LoginAsync(new LoginRequest { Identifier = "+970599222222", Password = "WrongPassword1!" }));
        Assert.True(ex.Errors.ContainsKey("Password"));
    }

    [Fact]
    public async Task InvalidEmailIdentifier_Handled()
    {
        var (login, _, _) = CreateService();
        var ex = await Assert.ThrowsAsync<ValidationException>(() => login.LoginAsync(new LoginRequest { Identifier = "invalid-email@", Password = Password }));
        // Should be treated as email not found, maps to Identifier/Email
        Assert.True(ex.Errors.ContainsKey("Identifier") || ex.Errors.ContainsKey("Email"));
    }

    [Fact]
    public async Task FieldSpecific_ResponseFollowsValidationProblemDetailsContract()
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(CreateRegister("fieldtest@example.com", "+970599333333", AccountTypes.RegularUser));
        var ex = await Assert.ThrowsAsync<ValidationException>(() => login.LoginAsync(new LoginRequest { Identifier = "fieldtest@example.com", Password = "WrongPassword1!" }));
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
        await registration.RegisterAsync(CreateRegister("success@example.com", "+970599444444", AccountTypes.RegularUser));
        var response = await login.LoginAsync(new LoginRequest { Identifier = "success@example.com", Password = Password });
        Assert.False(string.IsNullOrWhiteSpace(response.Token));
        Assert.Equal("success@example.com", response.Email);
    }

    [Fact]
    public async Task SuccessfulPhoneLogin_StillWorks()
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(CreateRegister("phoneok@example.com", "+970599555555", AccountTypes.RegularUser));
        var response = await login.LoginAsync(new LoginRequest { Identifier = "+970599555555", Password = Password });
        Assert.False(string.IsNullOrWhiteSpace(response.Token));
    }
}
