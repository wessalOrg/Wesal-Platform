using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Infrastructure.Auth;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Registration;
using Wesal.Infrastructure.Time;
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

public class LogoutSessionInvalidationShould
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

    private static (LoginService Login, RegistrationService Registration, LogoutService Logout, TokenRevocationRepository Revocations, ApplicationDbContext Context) CreateService()
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
        var revocations = new TokenRevocationRepository(context);

        var loginService = new LoginService(userManager, tokenService, new DateTimeService());
        var registrationService = new RegistrationService(userManager, roleManager);
        var logoutService = new LogoutService(revocations);

        return (loginService, registrationService, logoutService, revocations, context);
    }

    private static RegisterRequest CreateRegisterRequest(string email, string phoneNumber, string accountType) => new()
    {
        FullName = "Omar Khaled",
        Email = email,
        PhoneNumber = phoneNumber,
        Password = Password,
        ConfirmPassword = Password,
        AccountType = accountType
    };

    private static string GetJti(ClaimsPrincipal principal)
        => principal.FindFirstValue(JwtRegisteredClaimNames.Jti) ?? string.Empty;

    private static async Task<ClaimsPrincipal?> AuthenticateWithRevocationCheckAsync(
        string token,
        TokenRevocationRepository revocations)
    {
        var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
        var principal = handler.ValidateToken(token, JwtTokenValidationParametersFactory.Create(Settings), out _);

        var jti = GetJti(principal);

        if (string.IsNullOrWhiteSpace(jti) || await revocations.IsRevokedAsync(jti))
        {
            return null;
        }

        return principal;
    }

    private static string CreateToken(
        DateTime? expires,
        string[] roles,
        string secret = SecretKey,
        string issuer = "WesalTests",
        string audience = "WesalTests")
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(ApplicationClaimTypes.UserId, "user-1"),
            new(ApplicationClaimTypes.UserName, "ahmad"),
            new(ApplicationClaimTypes.Email, "ahmad@example.com")
        };

        claims.AddRange(roles.Select(role => new Claim(ApplicationClaimTypes.Role, role)));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            notBefore: DateTime.UtcNow.AddMinutes(-30),
            expires: expires,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    [Theory]
    [InlineData(AccountTypes.RegularUser, "regular@example.com", "+970599111111", ApplicationRoles.RegisteredUser)]
    [InlineData(AccountTypes.HallOwner, "owner@example.com", "+970599222222", ApplicationRoles.HallOwner)]
    public async Task ValidSession_AuthenticatesAgainstProtectedRequestCheck(
        string accountType,
        string email,
        string phoneNumber,
        string role)
    {
        var (login, registration, _, revocations, _) = CreateService();
        await registration.RegisterAsync(CreateRegisterRequest(email, phoneNumber, accountType));

        var response = await login.LoginAsync(new LoginRequest { Identifier = email, Password = Password });

        var principal = await AuthenticateWithRevocationCheckAsync(response.Token, revocations);

        Assert.NotNull(principal);
        Assert.True(principal!.Identity?.IsAuthenticated);
        Assert.True(principal.IsInRole(role));
        Assert.False(string.IsNullOrWhiteSpace(GetJti(principal)));
    }

    [Theory]
    [InlineData(AccountTypes.RegularUser, "regular@example.com", "+970599333333", ApplicationRoles.RegisteredUser)]
    [InlineData(AccountTypes.HallOwner, "owner@example.com", "+970599444444", ApplicationRoles.HallOwner)]
    public async Task AfterLogout_ReusedToken_IsRejectedForProtectedRequests(
        string accountType,
        string email,
        string phoneNumber,
        string role)
    {
        var (login, registration, logout, revocations, _) = CreateService();
        await registration.RegisterAsync(CreateRegisterRequest(email, phoneNumber, accountType));

        var response = await login.LoginAsync(new LoginRequest { Identifier = email, Password = Password });

        var beforeLogout = await AuthenticateWithRevocationCheckAsync(response.Token, revocations);
        Assert.NotNull(beforeLogout);
        Assert.True(beforeLogout!.IsInRole(role));

        var jti = GetJti(beforeLogout);
        Assert.False(string.IsNullOrWhiteSpace(jti));

        await logout.LogoutAsync(jti, response.Id);

        Assert.Null(await AuthenticateWithRevocationCheckAsync(response.Token, revocations));
    }

    [Fact]
    public void Logout_ExpiredToken_IsRejectedUpfrontByLifetimeValidation()
    {
        var (_, _, _, _, _) = CreateService();
        var expiredToken = CreateToken(expires: DateTime.UtcNow.AddMinutes(-10), roles: [ApplicationRoles.RegisteredUser]);

        Assert.Throws<SecurityTokenExpiredException>(() =>
            new JwtSecurityTokenHandler { MapInboundClaims = false }
                .ValidateToken(expiredToken, JwtTokenValidationParametersFactory.Create(Settings), out _));
    }

    [Fact]
    public void Logout_InvalidSignatureAndWrongIssuerTokens_AreRejectedUpfront()
    {
        var invalidSignatureToken = CreateToken(
            expires: DateTime.UtcNow.AddMinutes(30),
            roles: [ApplicationRoles.RegisteredUser],
            secret: "another_test_key_that_is_also_thirty_two_chars");
        var wrongIssuerToken = CreateToken(
            expires: DateTime.UtcNow.AddMinutes(30),
            roles: [ApplicationRoles.RegisteredUser],
            issuer: "OtherIssuer");

        var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };

        Assert.Throws<SecurityTokenSignatureKeyNotFoundException>(() =>
            handler.ValidateToken(invalidSignatureToken, JwtTokenValidationParametersFactory.Create(Settings), out _));
        Assert.Throws<SecurityTokenInvalidIssuerException>(() =>
            handler.ValidateToken(wrongIssuerToken, JwtTokenValidationParametersFactory.Create(Settings), out _));
    }

    [Fact]
    public async Task RepeatedLogout_WithAlreadyRevokedToken_DoesNotEstablishOrDuplicateSessionState()
    {
        var (login, registration, logout, revocations, context) = CreateService();
        await registration.RegisterAsync(
            CreateRegisterRequest("repeat@example.com", "+970599555555", AccountTypes.RegularUser));

        var response = await login.LoginAsync(new LoginRequest { Identifier = "repeat@example.com", Password = Password });

        var principal = await AuthenticateWithRevocationCheckAsync(response.Token, revocations);
        Assert.NotNull(principal);

        var jti = GetJti(principal!);
        await logout.LogoutAsync(jti, response.Id);
        await logout.LogoutAsync(jti, response.Id);

        Assert.Null(await AuthenticateWithRevocationCheckAsync(response.Token, revocations));
        Assert.Single(await context.RevokedTokens.Where(token => token.Jti == jti).ToListAsync());
    }

    [Fact]
    public async Task AfterLogout_OtherValidSessions_KeepAccessingProtectedRequests()
    {
        var (login, registration, logout, revocations, _) = CreateService();
        await registration.RegisterAsync(
            CreateRegisterRequest("multi@example.com", "+970599666666", AccountTypes.RegularUser));

        var firstLogin = await login.LoginAsync(new LoginRequest { Identifier = "multi@example.com", Password = Password });
        var secondLogin = await login.LoginAsync(new LoginRequest { Identifier = "multi@example.com", Password = Password });

        Assert.NotEqual(firstLogin.Token, secondLogin.Token);

        var firstPrincipal = await AuthenticateWithRevocationCheckAsync(firstLogin.Token, revocations);
        Assert.NotNull(firstPrincipal);

        var firstJti = GetJti(firstPrincipal!);
        await logout.LogoutAsync(firstJti, firstLogin.Id);

        Assert.Null(await AuthenticateWithRevocationCheckAsync(firstLogin.Token, revocations));
        Assert.NotNull(await AuthenticateWithRevocationCheckAsync(secondLogin.Token, revocations));
    }

    [Fact]
    public async Task LoginAfterLogout_IssuesFreshUsableSession_WithDifferentTokenId()
    {
        var (login, registration, logout, revocations, _) = CreateService();
        await registration.RegisterAsync(
            CreateRegisterRequest("relogin@example.com", "+970599777777", AccountTypes.RegularUser));

        var firstLogin = await login.LoginAsync(new LoginRequest { Identifier = "relogin@example.com", Password = Password });

        var firstPrincipal = await AuthenticateWithRevocationCheckAsync(firstLogin.Token, revocations);
        Assert.NotNull(firstPrincipal);

        await logout.LogoutAsync(GetJti(firstPrincipal!), firstLogin.Id);

        Assert.Null(await AuthenticateWithRevocationCheckAsync(firstLogin.Token, revocations));

        var secondLogin = await login.LoginAsync(new LoginRequest { Identifier = "relogin@example.com", Password = Password });

        Assert.NotEqual(firstLogin.Token, secondLogin.Token);
        Assert.NotNull(await AuthenticateWithRevocationCheckAsync(secondLogin.Token, revocations));
    }

    [Fact]
    public void Logout_WithoutAnyToken_CannotEstablishAuthenticatedSession()
    {
        var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };

        Assert.Throws<ArgumentNullException>(() =>
            handler.ValidateToken(string.Empty, JwtTokenValidationParametersFactory.Create(Settings), out _));
    }
}