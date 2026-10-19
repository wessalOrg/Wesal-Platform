using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Constants;
using Wesal.Domain.Entities;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Authorization;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// WESAL approval enforcement at the account level: the reusable
/// <c>RequireApprovedAccount</c> policy (endpoint-level) and the shared
/// <see cref="AccountApprovalGuard"/> (service-level) apply the same rule — an Event
/// Coordinator or Photographer whose approval status is not Approved cannot publish,
/// while ordinary registered users, hall owners, and administrators pass untouched.
/// The decision always reads the live database state, never a token claim.
/// </summary>
public class AccountApprovalGuardShould : IDisposable
{
    private const string BlockedMessage = "approved by an administrator";

    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly TestCurrentUser _currentUser = new();

    public AccountApprovalGuardShould()
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
        }).AddRoles<ApplicationRole>().AddEntityFrameworkStores<ApplicationDbContext>();
        services.AddLogging();

        // The same policy registration the API's Infrastructure DI performs, with the
        // real guard and real authorization handler resolved through DI — the policy
        // name, requirement, and handler wiring are exercised exactly as in production.
        services.AddSingleton<ICurrentUserService>(_currentUser);
        services.AddScoped<IAccountApprovalGuard, AccountApprovalGuard>();
        services.AddScoped<IAuthorizationHandler, ApprovedAccountAuthorizationHandler>();
        services.AddAuthorization(options => options.AddPolicy(
            ApplicationPolicies.RequireApprovedAccount,
            policy => policy.AddRequirements(new ApprovedAccountRequirement())));

        _provider = services.BuildServiceProvider();
        _context = _provider.GetRequiredService<ApplicationDbContext>();
        _context.Database.EnsureCreated();
        _userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();

        var roleManager = _provider.GetRequiredService<RoleManager<ApplicationRole>>();
        foreach (var role in new[]
                 {
                     ApplicationRoles.RegisteredUser, ApplicationRoles.HallOwner, ApplicationRoles.Admin,
                     ApplicationRoles.EventCoordinator, ApplicationRoles.Photographer
                 })
        {
            roleManager.CreateAsync(new ApplicationRole(role)).GetAwaiter().GetResult();
        }
    }

    private async Task<ApplicationUser> CreateUserAsync(
        string email,
        AccountApprovalStatus status,
        params string[] roles)
    {
        var user = new ApplicationUser
        {
            FullName = "Test User",
            Email = email,
            UserName = email,
            ApprovalStatus = status,
            IsSetupComplete = true
        };
        var result = await _userManager.CreateAsync(user, "Password123!");
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(string.Join(",", result.Errors.Select(e => e.Description)));
        }
        foreach (var role in roles)
        {
            await _userManager.AddToRoleAsync(user, role);
        }

        return user;
    }

    private AccountApprovalGuard CreateGuard(string? userId, bool authenticated, params string[] roles)
    {
        _currentUser.Set(userId, authenticated, roles);
        return new AccountApprovalGuard(_currentUser, _userManager);
    }

    // --- Service-level guard: EnsureCanPublishAsync (current user) ---------------------

    [Theory]
    [InlineData(AccountApprovalStatus.Pending)]
    [InlineData(AccountApprovalStatus.Rejected)]
    public async Task UnapprovedCoordinator_CannotPublish(AccountApprovalStatus status)
    {
        var user = await CreateUserAsync($"coord-{status}@example.com", status, ApplicationRoles.EventCoordinator);
        var guard = CreateGuard(user.Id, true, ApplicationRoles.EventCoordinator);

        var exception = await Assert.ThrowsAsync<ForbiddenException>(() => guard.EnsureCanPublishAsync());
        Assert.Contains(BlockedMessage, exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData(AccountApprovalStatus.Pending)]
    [InlineData(AccountApprovalStatus.Rejected)]
    public async Task UnapprovedPhotographer_CannotPublish(AccountApprovalStatus status)
    {
        var user = await CreateUserAsync($"photo-{status}@example.com", status, ApplicationRoles.Photographer);
        var guard = CreateGuard(user.Id, true, ApplicationRoles.Photographer);

        var exception = await Assert.ThrowsAsync<ForbiddenException>(() => guard.EnsureCanPublishAsync());
        Assert.Contains(BlockedMessage, exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task ApprovedRestrictedRoles_CanPublish(bool coordinator)
    {
        var roles = coordinator ? ApplicationRoles.EventCoordinator : ApplicationRoles.Photographer;
        var user = await CreateUserAsync($"approved-{coordinator}@example.com", AccountApprovalStatus.Approved, roles);
        var guard = CreateGuard(user.Id, true, roles);

        await guard.EnsureCanPublishAsync();
    }

    [Theory]
    [InlineData(AccountApprovalStatus.Pending)]
    [InlineData(AccountApprovalStatus.Rejected)]
    public async Task OrdinaryRegisteredUser_PassesRegardlessOfStatus(AccountApprovalStatus status)
    {
        var user = await CreateUserAsync($"plain-{status}@example.com", status, ApplicationRoles.RegisteredUser);
        var guard = CreateGuard(user.Id, true, ApplicationRoles.RegisteredUser);

        await guard.EnsureCanPublishAsync();
    }

    [Fact]
    public async Task HallOwner_Passes()
    {
        var user = await CreateUserAsync("owner@example.com", AccountApprovalStatus.Pending, ApplicationRoles.HallOwner);
        var guard = CreateGuard(user.Id, true, ApplicationRoles.HallOwner);

        await guard.EnsureCanPublishAsync();
    }

    [Fact]
    public async Task Admin_Passes()
    {
        var user = await CreateUserAsync("admin@example.com", AccountApprovalStatus.Approved, ApplicationRoles.Admin);
        var guard = CreateGuard(user.Id, true, ApplicationRoles.Admin);

        await guard.EnsureCanPublishAsync();
    }

    [Fact]
    public async Task DualRoleAccount_WithPendingPhotographerStatus_IsBlocked_LiveFromDatabase()
    {
        // The principal also carries RegisteredUser (the account type used for
        // registration), but the Photographer role on the same principal must still
        // trigger the live approval check.
        var user = await CreateUserAsync(
            "dual@example.com",
            AccountApprovalStatus.Pending,
            ApplicationRoles.RegisteredUser,
            ApplicationRoles.Photographer);
        var guard = CreateGuard(user.Id, true, ApplicationRoles.RegisteredUser, ApplicationRoles.Photographer);

        var exception = await Assert.ThrowsAsync<ForbiddenException>(() => guard.EnsureCanPublishAsync());
        Assert.Contains(BlockedMessage, exception.Message, StringComparison.OrdinalIgnoreCase);

        // Flipping the database status takes effect on the very next call — no token
        // refresh involved.
        user.ApprovalStatus = AccountApprovalStatus.Approved;
        await _userManager.UpdateAsync(user);
        await guard.EnsureCanPublishAsync();
    }

    [Fact]
    public async Task UnknownUser_FailsClosed()
    {
        var guard = CreateGuard("no-such-user", true, ApplicationRoles.Photographer);

        await Assert.ThrowsAsync<ForbiddenException>(() => guard.EnsureCanPublishAsync());
    }

    [Fact]
    public async Task Unauthenticated_ThrowsUnauthorized()
    {
        var guard = CreateGuard(null, false);

        await Assert.ThrowsAsync<UnauthorizedException>(() => guard.EnsureCanPublishAsync());
    }

    // --- Service-level guard: EnsureUserCanPublishAsync (by target user id) -------------

    [Theory]
    [InlineData(AccountApprovalStatus.Pending)]
    [InlineData(AccountApprovalStatus.Rejected)]
    public async Task UnapprovedTargetUser_CannotPublish(AccountApprovalStatus status)
    {
        var user = await CreateUserAsync($"target-{status}@example.com", status, ApplicationRoles.Photographer);
        var guard = CreateGuard("actor", true, ApplicationRoles.Admin);

        var exception = await Assert.ThrowsAsync<ForbiddenException>(
            () => guard.EnsureUserCanPublishAsync(user.Id));
        Assert.Contains(BlockedMessage, exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ApprovedTargetCoordinator_CanPublish()
    {
        var user = await CreateUserAsync("target-ok@example.com", AccountApprovalStatus.Approved, ApplicationRoles.EventCoordinator);
        var guard = CreateGuard("actor", true, ApplicationRoles.Admin);

        await guard.EnsureUserCanPublishAsync(user.Id);
    }

    [Fact]
    public async Task OrdinaryTargetUser_Passes()
    {
        var user = await CreateUserAsync("target-plain@example.com", AccountApprovalStatus.Pending, ApplicationRoles.RegisteredUser);
        var guard = CreateGuard("actor", true, ApplicationRoles.Admin);

        await guard.EnsureUserCanPublishAsync(user.Id);
    }

    [Fact]
    public async Task UnknownTargetUser_FailsClosed()
    {
        var guard = CreateGuard("actor", true, ApplicationRoles.Admin);

        await Assert.ThrowsAsync<ForbiddenException>(() => guard.EnsureUserCanPublishAsync("no-such-user"));
    }

    [Fact]
    public async Task EmptyTargetUserId_ThrowsUnauthorized()
    {
        var guard = CreateGuard("actor", true, ApplicationRoles.Admin);

        await Assert.ThrowsAsync<UnauthorizedException>(() => guard.EnsureUserCanPublishAsync("  "));
    }

    // --- Endpoint-level policy: RequireApprovedAccount -----------------------------------

    private async Task<AuthorizationResult> AuthorizePolicyAsync(
        string? userId,
        bool authenticated,
        params string[] roles)
    {
        _currentUser.Set(userId, authenticated, roles);

        var authService = _provider.GetRequiredService<IAuthorizationService>();
        return await authService.AuthorizeAsync(
            BuildPrincipal(userId, authenticated, roles),
            new DefaultHttpContext(),
            ApplicationPolicies.RequireApprovedAccount);
    }

    private static ClaimsPrincipal BuildPrincipal(string? userId, bool authenticated, params string[] roles)
    {
        var claims = new List<Claim>();
        if (authenticated && !string.IsNullOrWhiteSpace(userId))
        {
            claims.Add(new Claim(ClaimTypes.NameIdentifier, userId));
            claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));
        }

        return new ClaimsPrincipal(new ClaimsIdentity(claims, authenticationType: authenticated ? "Test" : null));
    }

    [Theory]
    [InlineData(ApplicationRoles.EventCoordinator)]
    [InlineData(ApplicationRoles.Photographer)]
    public async Task Policy_RejectsPendingRestrictedAccount(string role)
    {
        var user = await CreateUserAsync($"policy-pending-{role}@example.com", AccountApprovalStatus.Pending, role);

        var result = await AuthorizePolicyAsync(user.Id, true, role);

        Assert.False(result.Succeeded);
    }

    [Theory]
    [InlineData(ApplicationRoles.EventCoordinator)]
    [InlineData(ApplicationRoles.Photographer)]
    public async Task Policy_RejectsRejectedRestrictedAccount(string role)
    {
        var user = await CreateUserAsync($"policy-rejected-{role}@example.com", AccountApprovalStatus.Rejected, role);

        var result = await AuthorizePolicyAsync(user.Id, true, role);

        Assert.False(result.Succeeded);
    }

    [Theory]
    [InlineData(ApplicationRoles.EventCoordinator)]
    [InlineData(ApplicationRoles.Photographer)]
    public async Task Policy_AllowsApprovedRestrictedAccount(string role)
    {
        var user = await CreateUserAsync($"policy-approved-{role}@example.com", AccountApprovalStatus.Approved, role);

        var result = await AuthorizePolicyAsync(user.Id, true, role);

        Assert.True(result.Succeeded);
    }

    [Theory]
    [InlineData(ApplicationRoles.RegisteredUser)]
    [InlineData(ApplicationRoles.HallOwner)]
    [InlineData(ApplicationRoles.Admin)]
    public async Task Policy_AllowsEveryOtherAccountType(string role)
    {
        var user = await CreateUserAsync($"policy-other-{role}@example.com", AccountApprovalStatus.Pending, role);

        var result = await AuthorizePolicyAsync(user.Id, true, role);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public async Task Policy_RejectsUnauthenticatedCaller()
    {
        var result = await AuthorizePolicyAsync(null, false);

        Assert.False(result.Succeeded);
    }

    [Fact]
    public async Task Policy_FailsClosed_WhenThereIsNoHttpContextResource()
    {
        var user = await CreateUserAsync("noresource@example.com", AccountApprovalStatus.Pending, ApplicationRoles.RegisteredUser);
        _currentUser.Set(user.Id, true, ApplicationRoles.RegisteredUser);

        var authService = _provider.GetRequiredService<IAuthorizationService>();
        var result = await authService.AuthorizeAsync(
            BuildPrincipal(user.Id, true, ApplicationRoles.RegisteredUser),
            resource: null,
            ApplicationPolicies.RequireApprovedAccount);

        Assert.False(result.Succeeded);
    }

    [Fact]
    public void Policy_RequirementIsRegisteredUnderTheExpectedName()
    {
        // The constant must keep its value: endpoint metadata and DI both key on it.
        Assert.Equal("RequireApprovedAccount", ApplicationPolicies.RequireApprovedAccount);
        Assert.Equal("RequirePhotographer", ApplicationPolicies.RequirePhotographer);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }

    private sealed class TestCurrentUser : ICurrentUserService
    {
        private string? _userId;
        private string[] _roles = [];

        public void Set(string? userId, bool isAuthenticated, params string[] roles)
        {
            _userId = userId;
            IsAuthenticated = isAuthenticated;
            _roles = roles;
        }

        public string? UserId => _userId;
        public string? UserName => "test";
        public string? Email => "test@example.com";
        public bool IsAuthenticated { get; private set; }
        public IReadOnlyList<string> Roles => _roles;
    }
}
