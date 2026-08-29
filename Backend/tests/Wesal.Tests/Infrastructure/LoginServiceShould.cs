using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Auth;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Registration;
using Wesal.Infrastructure.Time;
using Wesal.Persistence.Data;

namespace Wesal.Tests.Infrastructure;

public class LoginServiceShould
{
    private const string Password = "Password123!";
    private const string SecretKey = "test_signing_key_that_is_at_least_32_characters_long";

    private static RegisterRequest CreateRegisterRequest(
        string email,
        string phoneNumber,
        string accountType) => new()
    {
        FullName = "Omar Khaled",
        Email = email,
        PhoneNumber = phoneNumber,
        Password = Password,
        ConfirmPassword = Password,
        AccountType = accountType
    };

    private static (LoginService Login, RegistrationService Registration, ApplicationDbContext Context) CreateService()
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

                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            })
            .AddRoles<ApplicationRole>()
            .AddEntityFrameworkStores<ApplicationDbContext>();

        var provider = services.BuildServiceProvider();
        var userManager = provider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = provider.GetRequiredService<RoleManager<ApplicationRole>>();
        var context = provider.GetRequiredService<ApplicationDbContext>();

        var tokenService = new TokenService(Options.Create(new JwtSettings
        {
            Issuer = "WesalTests",
            Audience = "WesalTests",
            SecretKey = SecretKey,
            ExpirationMinutes = 30,
            ClockSkewMinutes = 5
        }));

        var loginService = new LoginService(userManager, tokenService, new DateTimeService());
        var registrationService = new RegistrationService(userManager, roleManager);

        return (loginService, registrationService, context);
    }

    [Fact]
    public async Task Login_RegisteredUserByEmail_ReturnsTokenAndUserDetails()
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(
            CreateRegisterRequest("regular@example.com", "+970599111111", AccountTypes.RegularUser));

        var response = await login.LoginAsync(new LoginRequest
        {
            Identifier = "regular@example.com",
            Password = Password
        });

        Assert.False(string.IsNullOrWhiteSpace(response.Token));
        Assert.Equal(3, response.Token.Split('.').Length);
        Assert.Equal(AccountTypes.RegularUser, response.AccountType);
        Assert.Equal(ApplicationRoles.RegisteredUser, response.Role);
        Assert.Equal("Omar Khaled", response.FullName);
        Assert.Equal("regular@example.com", response.Email);
        Assert.Equal("+970599111111", response.PhoneNumber);
        Assert.False(string.IsNullOrEmpty(response.Id));
    }

    [Fact]
    public async Task Login_HallOwnerByEmail_ReturnsTokenAndRole()
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(
            CreateRegisterRequest("owner@example.com", "+970599222222", AccountTypes.HallOwner));

        var response = await login.LoginAsync(new LoginRequest
        {
            Identifier = "owner@example.com",
            Password = Password
        });

        Assert.Equal(AccountTypes.HallOwner, response.AccountType);
        Assert.Equal(ApplicationRoles.HallOwner, response.Role);
        Assert.False(string.IsNullOrWhiteSpace(response.Token));
    }

    [Theory]
    [InlineData("user@example.com", "+970599333333", AccountTypes.RegularUser)]
    [InlineData("ownerphone@example.com", "+970599444444", AccountTypes.HallOwner)]
    public async Task Login_ByPhoneNumber_ReturnsToken(string email, string phoneNumber, string accountType)
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(CreateRegisterRequest(email, phoneNumber, accountType));

        var response = await login.LoginAsync(new LoginRequest
        {
            Identifier = phoneNumber,
            Password = Password
        });

        Assert.Equal(email, response.Email);
        Assert.False(string.IsNullOrWhiteSpace(response.Token));

        var claims = new JwtSecurityTokenHandler().ReadJwtToken(response.Token).Claims
            .ToDictionary(claim => claim.Type, claim => claim.Value);
        Assert.Equal(accountType == AccountTypes.RegularUser ? AccountTypes.RegularUser : AccountTypes.HallOwner, response.AccountType);
        Assert.Contains(claims, claim => claim.Key == ApplicationClaimTypes.UserId && claim.Value == response.Id);
        Assert.Contains(claims, claim => claim.Key == ApplicationClaimTypes.Role && claim.Value == response.Role);
    }

    [Fact]
    public async Task Login_EmailCaseInsensitive_ReturnsToken()
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(
            CreateRegisterRequest("Case.User@Example.com", "+970599555555", AccountTypes.RegularUser));

        var response = await login.LoginAsync(new LoginRequest
        {
            Identifier = "case.user@example.com",
            Password = Password
        });

        Assert.False(string.IsNullOrWhiteSpace(response.Token));
        Assert.Equal("Case.User@Example.com", response.Email);
    }

    [Fact]
    public async Task Login_WrongPassword_ThrowsUnauthorizedExceptionAndIncrementsFailedAttempts()
    {
        var (login, registration, context) = CreateService();
        await registration.RegisterAsync(
            CreateRegisterRequest("wrongpass@example.com", "+970599666666", AccountTypes.RegularUser));

        var exception = await Assert.ThrowsAsync<UnauthorizedException>(() =>
            login.LoginAsync(new LoginRequest
            {
                Identifier = "wrongpass@example.com",
                Password = "WrongPassword1!"
            }));

        Assert.NotNull(exception);

        var user = await context.Users.SingleAsync(item => item.Email == "wrongpass@example.com");
        Assert.Equal(1, user.AccessFailedCount);
    }

    [Fact]
    public async Task Login_UnknownEmail_ThrowsUnauthorizedExceptionMatchingWrongPassword()
    {
        var (login, _, _) = CreateService();

        var unknownException = await Assert.ThrowsAsync<UnauthorizedException>(() =>
            login.LoginAsync(new LoginRequest
            {
                Identifier = "nobody@example.com",
                Password = Password
            }));
        var wrongPasswordException = await Assert.ThrowsAsync<UnauthorizedException>(() =>
            login.LoginAsync(new LoginRequest
            {
                Identifier = "regular@example.com",
                Password = "WrongPassword1!"
            }));

        Assert.Equal(wrongPasswordException.Message, unknownException.Message);
    }

    [Fact]
    public async Task Login_UnknownPhoneNumber_ThrowsUnauthorizedExceptionWithoutEnumerating()
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(
            CreateRegisterRequest("known@example.com", "+970599123456", AccountTypes.RegularUser));

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            login.LoginAsync(new LoginRequest
            {
                Identifier = "unknown-phone",
                Password = Password
            }));

        await Assert.ThrowsAsync<UnauthorizedException>(() =>
            login.LoginAsync(new LoginRequest
            {
                Identifier = "+000000000000",
                Password = Password
            }));
    }

    [Fact]
    public async Task Login_FourWrongAttempts_ThenCorrectPassword_SucceedsAndResetsFailedAttempts()
    {
        var (login, registration, context) = CreateService();
        await registration.RegisterAsync(
            CreateRegisterRequest("recovery@example.com", "+970599777777", AccountTypes.RegularUser));

        for (var attempt = 0; attempt < 4; attempt++)
        {
            await Assert.ThrowsAsync<UnauthorizedException>(() =>
                login.LoginAsync(new LoginRequest
                {
                    Identifier = "recovery@example.com",
                    Password = "WrongPassword1!"
                }));
        }

        var response = await login.LoginAsync(new LoginRequest
        {
            Identifier = "recovery@example.com",
            Password = Password
        });

        Assert.False(string.IsNullOrWhiteSpace(response.Token));

        var user = await context.Users.SingleAsync(item => item.Email == "recovery@example.com");
        Assert.Equal(0, user.AccessFailedCount);
        Assert.Null(user.LockoutEnd);
    }

    [Fact]
    public async Task Login_FifthWrongAttempt_LocksAccountAndReturnsBlockedMessageWithRemainingDuration()
    {
        var (login, registration, context) = CreateService();
        await registration.RegisterAsync(
            CreateRegisterRequest("locked@example.com", "+970599888888", AccountTypes.RegularUser));

        for (var attempt = 0; attempt < 4; attempt++)
        {
            await Assert.ThrowsAsync<UnauthorizedException>(() =>
                login.LoginAsync(new LoginRequest
                {
                    Identifier = "locked@example.com",
                    Password = "WrongPassword1!"
                }));
        }

        var exception = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            login.LoginAsync(new LoginRequest
            {
                Identifier = "locked@example.com",
                Password = "WrongPassword1!"
            }));

        Assert.Equal("AccountBlocked", exception.Code);
        Assert.Contains("blocked", exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Matches(@"\d+ minute", exception.Message);

        var user = await context.Users.SingleAsync(item => item.Email == "locked@example.com");
        Assert.NotNull(user.LockoutEnd);
    }

    [Fact]
    public async Task Login_BlockedAccount_EvenWithCorrectPassword_ReturnsBlockedMessageWithRemainingDuration()
    {
        var (login, registration, context) = CreateService();
        await registration.RegisterAsync(
            CreateRegisterRequest("blocked@example.com", "+970599999999", AccountTypes.RegularUser));

        var user = await context.Users.SingleAsync(item => item.Email == "blocked@example.com");
        user.LockoutEnd = DateTimeOffset.UtcNow.AddMinutes(30);
        await context.SaveChangesAsync();

        var exception = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            login.LoginAsync(new LoginRequest
            {
                Identifier = "blocked@example.com",
                Password = Password
            }));

        Assert.Equal("AccountBlocked", exception.Code);
        Assert.Contains("30 minute", exception.Message);
        Assert.Matches(@"\d+ minute", exception.Message);
    }

    [Fact]
    public async Task Login_BlockedAccountAfterLockoutExpires_CorrectPasswordSucceeds()
    {
        var (login, registration, context) = CreateService();
        await registration.RegisterAsync(
            CreateRegisterRequest("expired@example.com", "+970599000000", AccountTypes.RegularUser));

        var user = await context.Users.SingleAsync(item => item.Email == "expired@example.com");
        user.LockoutEnd = DateTimeOffset.UtcNow.AddMinutes(-1);
        await context.SaveChangesAsync();

        var response = await login.LoginAsync(new LoginRequest
        {
            Identifier = "expired@example.com",
            Password = Password
        });

        Assert.False(string.IsNullOrWhiteSpace(response.Token));
    }

    [Fact]
    public async Task Login_WhitespaceSurroundingIdentifier_TrimsAndSucceeds()
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(
            CreateRegisterRequest("spaces@example.com", "+970599555000", AccountTypes.RegularUser));

        var response = await login.LoginAsync(new LoginRequest
        {
            Identifier = "  spaces@example.com  ",
            Password = Password
        });

        Assert.False(string.IsNullOrWhiteSpace(response.Token));
    }
}