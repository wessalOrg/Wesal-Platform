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

public class LoginRateLimitingShould
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

    [Fact]
    public async Task RepeatedFailures_Threshold_Blocks()
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(new RegisterRequest { FullName = "User", Email = "rate@example.com", PhoneNumber = "+970599000001", Password = Password, ConfirmPassword = Password, AccountType = AccountTypes.RegularUser });
        for (int i = 0; i < 4; i++)
            await Assert.ThrowsAsync<ValidationException>(() => login.LoginAsync(new LoginRequest { Identifier = "rate@example.com", Password = "WrongPassword1!" }));
        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => login.LoginAsync(new LoginRequest { Identifier = "rate@example.com", Password = "WrongPassword1!" }));
        Assert.Equal("AccountBlocked", ex.Code);
        Assert.Contains("blocked", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task BlockedResponse_FollowsExistingErrorStructure()
    {
        var (login, registration, context) = CreateService();
        await registration.RegisterAsync(new RegisterRequest { FullName = "User", Email = "blocked2@example.com", PhoneNumber = "+970599000002", Password = Password, ConfirmPassword = Password, AccountType = AccountTypes.RegularUser });
        var user = await context.Users.SingleAsync(u => u.Email == "blocked2@example.com");
        user.LockoutEnd = DateTimeOffset.UtcNow.AddMinutes(15);
        await context.SaveChangesAsync();
        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => login.LoginAsync(new LoginRequest { Identifier = "blocked2@example.com", Password = Password }));
        Assert.Equal("AccountBlocked", ex.Code);
        Assert.DoesNotContain("PasswordHash", ex.Message);
        Assert.DoesNotContain("stack", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AfterLockoutExpires_SuccessfulLoginPossible()
    {
        var (login, registration, context) = CreateService();
        await registration.RegisterAsync(new RegisterRequest { FullName = "User", Email = "expire@example.com", PhoneNumber = "+970599000003", Password = Password, ConfirmPassword = Password, AccountType = AccountTypes.RegularUser });
        var user = await context.Users.SingleAsync(u => u.Email == "expire@example.com");
        user.LockoutEnd = DateTimeOffset.UtcNow.AddMinutes(-1);
        await context.SaveChangesAsync();
        var response = await login.LoginAsync(new LoginRequest { Identifier = "expire@example.com", Password = Password });
        Assert.False(string.IsNullOrWhiteSpace(response.Token));
    }

    [Fact]
    public async Task SuccessfulLogin_RemainsPossible_AfterLegitimateRecovery()
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(new RegisterRequest { FullName = "User", Email = "recovery2@example.com", PhoneNumber = "+970599000004", Password = Password, ConfirmPassword = Password, AccountType = AccountTypes.RegularUser });
        for (int i = 0; i < 4; i++)
            await Assert.ThrowsAsync<ValidationException>(() => login.LoginAsync(new LoginRequest { Identifier = "recovery2@example.com", Password = "WrongPassword1!" }));
        var response = await login.LoginAsync(new LoginRequest { Identifier = "recovery2@example.com", Password = Password });
        Assert.False(string.IsNullOrWhiteSpace(response.Token));
    }

    [Fact]
    public async Task RateLimit_DoesNotExposeSensitiveInfo()
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(new RegisterRequest { FullName = "User", Email = "sensitive@example.com", PhoneNumber = "+970599000005", Password = Password, ConfirmPassword = Password, AccountType = AccountTypes.RegularUser });
        for (int i = 0; i < 5; i++)
            try { await login.LoginAsync(new LoginRequest { Identifier = "sensitive@example.com", Password = "WrongPassword1!" }); } catch { }
        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => login.LoginAsync(new LoginRequest { Identifier = "sensitive@example.com", Password = "WrongPassword1!" }));
        var msg = ex.Message;
        Assert.DoesNotContain("PasswordHash", msg);
        Assert.DoesNotContain("stack", msg, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("database", msg, StringComparison.OrdinalIgnoreCase);
    }
}
