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
using Wesal.Persistence.Data;
using Wesal.Persistence.Repositories;

namespace Wesal.Tests.Infrastructure;

public class LogoutServiceShould
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

    private static (LogoutService Logout, TokenRevocationRepository Revocations, ApplicationDbContext Context, UserManager<ApplicationUser> UserManager, RoleManager<ApplicationRole> RoleManager) CreateService()
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

        var provider = services.BuildServiceProvider();
        var userManager = provider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = provider.GetRequiredService<RoleManager<ApplicationRole>>();
        var context = provider.GetRequiredService<ApplicationDbContext>();

        var revocations = new TokenRevocationRepository(context);
        var logout = new LogoutService(revocations);

        return (logout, revocations, context, userManager, roleManager);
    }

    private static async Task<ApplicationUser> CreateUserWithRoleAsync(
        UserManager<ApplicationUser> userManager,
        RoleManager<ApplicationRole> roleManager,
        string email,
        string role)
    {
        if (!await roleManager.RoleExistsAsync(role))
        {
            var roleResult = await roleManager.CreateAsync(new ApplicationRole(role));
            Assert.True(roleResult.Succeeded);
        }

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            FullName = "Omar Khaled",
            PhoneNumber = "+970599000111"
        };

        var createResult = await userManager.CreateAsync(user, Password);
        Assert.True(createResult.Succeeded);

        var assignResult = await userManager.AddToRoleAsync(user, role);
        Assert.True(assignResult.Succeeded);

        return user;
    }

    private static async Task<string> CreateTokenAsync(
        UserManager<ApplicationUser> userManager,
        ApplicationUser user)
    {
        var roles = await userManager.GetRolesAsync(user);
        var tokenService = new TokenService(Options.Create(Settings));

        return tokenService.CreateToken(user.Id, user.UserName ?? user.Email!, user.Email ?? string.Empty, roles);
    }

    private static string GetJti(string token)
        => new JwtSecurityTokenHandler().ReadJwtToken(token).Id;

    [Theory]
    [InlineData(ApplicationRoles.RegisteredUser)]
    [InlineData(ApplicationRoles.HallOwner)]
    [InlineData(ApplicationRoles.Admin)]
    public async Task Logout_AuthenticatedSession_RevokesPresentedToken(string role)
    {
        var (logout, revocations, context, userManager, roleManager) = CreateService();
        var user = await CreateUserWithRoleAsync(
            userManager,
            roleManager,
            $"{role.ToLowerInvariant()}@example.com",
            role);
        var token = await CreateTokenAsync(userManager, user);
        var jti = GetJti(token);

        var response = await logout.LogoutAsync(jti, user.Id);

        Assert.False(string.IsNullOrWhiteSpace(response.Message));
        Assert.True(await revocations.IsRevokedAsync(jti));

        var record = await context.RevokedTokens.SingleAsync(item => item.Jti == jti);
        Assert.Equal(user.Id, record.UserId);
    }

    [Fact]
    public async Task Logout_RepeatedLogout_IsIdempotentAndNeverFails()
    {
        var (logout, revocations, context, userManager, roleManager) = CreateService();
        var user = await CreateUserWithRoleAsync(userManager, roleManager, "repeat@example.com", ApplicationRoles.RegisteredUser);
        var token = await CreateTokenAsync(userManager, user);
        var jti = GetJti(token);

        var first = await logout.LogoutAsync(jti, user.Id);
        var second = await logout.LogoutAsync(jti, user.Id);
        var third = await logout.LogoutAsync(jti, user.Id);

        Assert.False(string.IsNullOrWhiteSpace(first.Message));
        Assert.Equal(first.Message, second.Message);
        Assert.Equal(first.Message, third.Message);

        Assert.Single(await context.RevokedTokens.Where(item => item.Jti == jti).ToListAsync());
        Assert.True(await revocations.IsRevokedAsync(jti));
    }

    [Fact]
    public async Task Logout_RevokesOnlyThePresentedSession_AndLeavesOtherSessionsOfSameUserActive()
    {
        var (logout, revocations, _, userManager, roleManager) = CreateService();
        var user = await CreateUserWithRoleAsync(userManager, roleManager, "multi@example.com", ApplicationRoles.RegisteredUser);

        var firstToken = await CreateTokenAsync(userManager, user);
        var secondToken = await CreateTokenAsync(userManager, user);
        var firstJti = GetJti(firstToken);
        var secondJti = GetJti(secondToken);

        Assert.NotEqual(firstJti, secondJti);

        await logout.LogoutAsync(firstJti, user.Id);

        Assert.True(await revocations.IsRevokedAsync(firstJti));
        Assert.False(await revocations.IsRevokedAsync(secondJti));
    }

    [Fact]
    public async Task Logout_DoesNotRevokeAnotherUsersToken()
    {
        var (logout, revocations, _, userManager, roleManager) = CreateService();
        var owner = await CreateUserWithRoleAsync(userManager, roleManager, "owner@example.com", ApplicationRoles.HallOwner);
        var guest = await CreateUserWithRoleAsync(userManager, roleManager, "guest@example.com", ApplicationRoles.RegisteredUser);

        var ownerToken = await CreateTokenAsync(userManager, owner);
        var guestToken = await CreateTokenAsync(userManager, guest);

        await logout.LogoutAsync(GetJti(ownerToken), owner.Id);

        Assert.True(await revocations.IsRevokedAsync(GetJti(ownerToken)));
        Assert.False(await revocations.IsRevokedAsync(GetJti(guestToken)));
    }

    [Fact]
    public async Task Logout_WithoutSessionIdentifier_ThrowsUnauthorizedAndDoesNotRevokeAnything()
    {
        var (logout, revocations, context, _, _) = CreateService();

        await Assert.ThrowsAsync<UnauthorizedException>(() => logout.LogoutAsync("", "user-1"));

        Assert.Empty(await context.RevokedTokens.ToListAsync());
        Assert.False(await revocations.IsRevokedAsync(""));
    }

    [Fact]
    public void LogoutResponse_DoesNotExposeAnySensitiveAuthenticationData()
    {
        var properties = typeof(LogoutResponse).GetProperties().Select(property => property.Name).ToArray();

        Assert.Equal(["Message"], properties);
        Assert.DoesNotContain("Token", properties);
        Assert.DoesNotContain("Password", properties);
        Assert.DoesNotContain("Jti", properties);
    }
}