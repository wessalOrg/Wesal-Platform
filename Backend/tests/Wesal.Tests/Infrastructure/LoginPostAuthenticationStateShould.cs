using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Auth;
using Wesal.Infrastructure.CurrentUser;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Time;
using Wesal.Persistence.Data;

namespace Wesal.Tests.Infrastructure;

public class LoginPostAuthenticationStateShould
{
    private const string Password = "Password123!";
    private const string SecretKey = "test_signing_key_that_is_at_least_32_characters_long";

    private static JwtSettings Settings => new()
    {
        Issuer = "WesalTests",
        Audience = "WesalTests",
        SecretKey = SecretKey,
        ExpirationMinutes = 30,
        ClockSkewMinutes = 5
    };

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

    private static (LoginService Login, AuthService Registration, ApplicationDbContext Context) CreateService()
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

        var tokenService = new TokenService(Options.Create(Settings));

        var loginService = new LoginService(userManager, tokenService, new DateTimeService());
        var registrationService = new AuthService(userManager, roleManager, tokenService);

        return (loginService, registrationService, context);
    }

    private static ClaimsPrincipal ValidateAsMiddleware(string token) =>
        new JwtSecurityTokenHandler { MapInboundClaims = false }
            .ValidateToken(token, JwtTokenValidationParametersFactory.Create(Settings), out _);

    [Theory]
    [InlineData(AccountTypes.RegularUser, "regular@example.com", "+970599111111", ApplicationRoles.RegisteredUser)]
    [InlineData(AccountTypes.HallOwner, "owner@example.com", "+970599222222", ApplicationRoles.HallOwner)]
    public async Task Login_TokenAcceptedByMiddlewareParametersExposesAuthenticatedIdentityAndRoleClaims(
        string accountType,
        string email,
        string phoneNumber,
        string expectedRole)
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(CreateRegisterRequest(email, phoneNumber, accountType));

        var response = await login.LoginAsync(new LoginRequest
        {
            Identifier = email,
            Password = Password
        });

        var principal = ValidateAsMiddleware(response.Token);

        Assert.True(principal.Identity?.IsAuthenticated);
        Assert.Equal(email, principal.Identity?.Name);
        Assert.Equal(response.Id, principal.FindFirstValue(ApplicationClaimTypes.UserId));
        Assert.Equal(email, principal.FindFirstValue(ApplicationClaimTypes.Email));
        Assert.Equal(accountType, response.AccountType);

        var roleClaims = principal.FindAll(ApplicationClaimTypes.Role).Select(claim => claim.Value).ToArray();
        Assert.Single(roleClaims);
        Assert.Equal(expectedRole, roleClaims[0]);
        Assert.True(principal.IsInRole(expectedRole));
    }

    [Theory]
    [InlineData(AccountTypes.RegularUser, "regularphone@example.com", "+970599333333", ApplicationRoles.RegisteredUser)]
    [InlineData(AccountTypes.HallOwner, "ownerphone@example.com", "+970599444444", ApplicationRoles.HallOwner)]
    public async Task LoginByPhone_ProducesTokenAcceptedByMiddlewareParameters(
        string accountType,
        string email,
        string phoneNumber,
        string expectedRole)
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(CreateRegisterRequest(email, phoneNumber, accountType));

        var response = await login.LoginAsync(new LoginRequest
        {
            Identifier = phoneNumber,
            Password = Password
        });

        var principal = ValidateAsMiddleware(response.Token);

        Assert.True(principal.Identity?.IsAuthenticated);
        Assert.Equal(email, principal.Identity?.Name);
        Assert.Equal(response.Id, principal.FindFirstValue(ApplicationClaimTypes.UserId));
        Assert.Equal(accountType, response.AccountType);
        Assert.Equal(expectedRole, Assert.Single(principal.FindAll(ApplicationClaimTypes.Role).Select(claim => claim.Value)));
    }

    [Theory]
    [InlineData(AccountTypes.RegularUser, "regular@example.com", "+970599555555", false)]
    [InlineData(AccountTypes.HallOwner, "ownerauthz@example.com", "+970599666666", true)]
    public async Task Login_TokenSatisfiesProtectedEndpointAuthorizationPolicies(
        string accountType,
        string email,
        string phoneNumber,
        bool expectsHallOwnerAccess)
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(CreateRegisterRequest(email, phoneNumber, accountType));

        var response = await login.LoginAsync(new LoginRequest
        {
            Identifier = email,
            Password = Password
        });

        var principal = ValidateAsMiddleware(response.Token);

        Assert.True(principal.Identity?.IsAuthenticated);

        var isAuthorizedAsRegisteredUser = principal.IsInRole(ApplicationRoles.RegisteredUser)
            || principal.IsInRole(ApplicationRoles.HallOwner)
            || principal.IsInRole(ApplicationRoles.Admin);
        Assert.True(isAuthorizedAsRegisteredUser);

        Assert.Equal(expectsHallOwnerAccess, principal.IsInRole(ApplicationRoles.HallOwner));

        Assert.False(principal.IsInRole(ApplicationRoles.Admin));
    }

    [Fact]
    public async Task Login_TokenEstablishesAuthenticatedStateUsableForSubsequentProtectedRequests()
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(
            CreateRegisterRequest("owner@example.com", "+970599777777", AccountTypes.HallOwner));

        var response = await login.LoginAsync(new LoginRequest
        {
            Identifier = "owner@example.com",
            Password = Password
        });

        var accessor = new HttpContextAccessor
        {
            HttpContext = new DefaultHttpContext { User = ValidateAsMiddleware(response.Token) }
        };
        var currentUser = new CurrentUserService(accessor);

        Assert.True(currentUser.IsAuthenticated);
        Assert.Equal(response.Id, currentUser.UserId);
        Assert.Equal("owner@example.com", currentUser.UserName);
        Assert.Equal("owner@example.com", currentUser.Email);
        Assert.Equal(ApplicationRoles.HallOwner, Assert.Single(currentUser.Roles));
    }

    [Fact]
    public async Task Login_WrongPassword_DoesNotEstablishAuthenticatedSession()
    {
        var (login, registration, context) = CreateService();
        await registration.RegisterAsync(
            CreateRegisterRequest("regular@example.com", "+970599888888", AccountTypes.RegularUser));

        await Assert.ThrowsAsync<ValidationException>(() =>
            login.LoginAsync(new LoginRequest
            {
                Identifier = "regular@example.com",
                Password = "WrongPassword1!"
            }));

        var user = await context.Users.SingleAsync(item => item.Email == "regular@example.com");

        Assert.Equal(1, user.AccessFailedCount);
        Assert.Null(user.LockoutEnd);
    }

    [Fact]
    public async Task Login_TokenIsValidImmediatelyAndExpiresWithinConfiguredSessionWindow()
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(
            CreateRegisterRequest("regular@example.com", "+970599000001", AccountTypes.RegularUser));

        var response = await login.LoginAsync(new LoginRequest
        {
            Identifier = "regular@example.com",
            Password = Password
        });

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(response.Token);

        Assert.True(jwt.ValidTo > DateTime.UtcNow);
        Assert.True(jwt.ValidTo <= DateTime.UtcNow.AddMinutes(Settings.ExpirationMinutes + 1));
    }

    [Fact]
    public async Task Login_TokenWithDifferentSigningSecret_IsRejectedByMiddlewareValidation()
    {
        var (login, registration, _) = CreateService();
        await registration.RegisterAsync(
            CreateRegisterRequest("regular@example.com", "+970599000002", AccountTypes.RegularUser));

        var response = await login.LoginAsync(new LoginRequest
        {
            Identifier = "regular@example.com",
            Password = Password
        });

        var otherSettings = new JwtSettings
        {
            Issuer = Settings.Issuer,
            Audience = Settings.Audience,
            SecretKey = "another_test_key_that_is_also_thirty_two_chars",
            ExpirationMinutes = Settings.ExpirationMinutes,
            ClockSkewMinutes = Settings.ClockSkewMinutes
        };

        var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };

        Assert.Throws<SecurityTokenSignatureKeyNotFoundException>(() =>
            handler.ValidateToken(response.Token, JwtTokenValidationParametersFactory.Create(otherSettings), out _));
    }
}