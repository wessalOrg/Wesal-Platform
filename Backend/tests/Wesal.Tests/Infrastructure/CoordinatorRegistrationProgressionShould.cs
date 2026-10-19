using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Enums;
using Wesal.Infrastructure.Auth;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Registration must put the new coordinator and photographer roles on exactly the
/// same footing as the existing roles, while flipping one deliberate difference: a
/// freshly registered Event Coordinator or Photographer starts setup-incomplete and
/// Pending, whereas RegularUser and HallOwner keep the established immediate-ready
/// behaviour. These facts pin the whole auth-flow consistency contract the coordinator
/// setup endpoint depends on.
/// </summary>
public class CoordinatorRegistrationProgressionShould : IDisposable
{
    private readonly ServiceProvider _provider;
    private readonly ApplicationDbContext _context;
    private readonly AuthService _authService;
    private readonly UserManager<ApplicationUser> _userManager;

    public CoordinatorRegistrationProgressionShould()
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
        services.AddScoped<ITokenService, TokenService>();
        services.Configure<JwtSettings>(o =>
        {
            o.SecretKey = "TestSecretKeyForTestingPurposesOnly12345";
            o.Issuer = "WesalAPI";
            o.Audience = "WesalClients";
            o.ExpirationMinutes = 60;
            o.ClockSkewMinutes = 5;
        });
        _provider = services.BuildServiceProvider();
        _context = _provider.GetRequiredService<ApplicationDbContext>();
        _context.Database.EnsureCreated();
        var roleManager = _provider.GetRequiredService<RoleManager<ApplicationRole>>();
        foreach (var role in ApplicationRoles.All)
        {
            roleManager.CreateAsync(new ApplicationRole(role)).GetAwaiter().GetResult();
        }
        _userManager = _provider.GetRequiredService<UserManager<ApplicationUser>>();
        _authService = new AuthService(
            _userManager,
            roleManager,
            _provider.GetRequiredService<ITokenService>(),
            NullEmailService.Instance,
            Options.Create(new PasswordResetOptions()),
            NullLogger<AuthService>.Instance);
    }

    private static RegisterRequest Request(string accountType, string email)
        => new("Setup Test", email, "Password123!", "Password123!", accountType);

    [Theory]
    [InlineData(AccountTypes.EventCoordinator)]
    [InlineData(AccountTypes.Photographer)]
    public async Task NewCoordinatorRoles_RegisterAsSetupIncompleteAndPending(string accountType)
    {
        var response = await _authService.RegisterAsync(Request(accountType, $"{accountType}@example.com"));

        Assert.False(response.IsSetupComplete);
        Assert.Equal(AccountApprovalStatus.Pending, response.ApprovalStatus);

        var user = await _userManager.FindByEmailAsync($"{accountType}@example.com");
        Assert.NotNull(user);
        Assert.False(user!.IsSetupComplete);
        Assert.Equal(AccountApprovalStatus.Pending, user.ApprovalStatus);

        var expectedRole = AccountTypes.ToRole(accountType);
        var roles = await _userManager.GetRolesAsync(user);
        Assert.Contains(expectedRole, roles);
    }

    [Theory]
    [InlineData(AccountTypes.RegularUser)]
    [InlineData(AccountTypes.HallOwner)]
    public async Task ExistingAccountTypes_RegisterAsSetupCompleteAndApproved(string accountType)
    {
        var response = await _authService.RegisterAsync(Request(accountType, $"{accountType}-legacy@example.com"));

        Assert.True(response.IsSetupComplete);
        Assert.Equal(AccountApprovalStatus.Approved, response.ApprovalStatus);

        var user = await _userManager.FindByEmailAsync($"{accountType}-legacy@example.com");
        Assert.NotNull(user);
        Assert.True(user!.IsSetupComplete);
        Assert.Equal(AccountApprovalStatus.Approved, user.ApprovalStatus);
    }

    [Fact]
    public async Task CoordinatorRegistration_StillReturnsTokenAndFullProfileData()
    {
        var response = await _authService.RegisterAsync(Request(AccountTypes.EventCoordinator, "token-check@example.com"));

        Assert.False(string.IsNullOrWhiteSpace(response.Id));
        Assert.False(string.IsNullOrWhiteSpace(response.Token));
        Assert.Equal(AccountTypes.EventCoordinator, response.AccountType);
        Assert.Equal(ApplicationRoles.EventCoordinator, response.Role);
    }

    [Fact]
    public async Task CoordinatorRegistration_ResponseNeverLeaksPassword()
    {
        var response = await _authService.RegisterAsync(Request(AccountTypes.Photographer, "noleak@example.com"));

        var json = System.Text.Json.JsonSerializer.Serialize(response);
        Assert.DoesNotContain("Password123!", json);
        Assert.DoesNotContain("PasswordHash", json);
    }

    [Fact]
    public async Task CoordinatorDuplicateEmail_RemainsRejected()
    {
        await _authService.RegisterAsync(Request(AccountTypes.EventCoordinator, "dup@example.com"));

        await ThrowsConflictForDuplicate();
    }

    private async Task ThrowsConflictForDuplicate()
    {
        var duplicate = new RegisterRequest("Other", "dup@example.com", "Password123!", "Password123!", AccountTypes.Photographer);
        await Xunit.Assert.ThrowsAsync<Wesal.Domain.Exceptions.ConflictException>(() => _authService.RegisterAsync(duplicate));
    }

    [Fact]
    public async Task PhotographerRegistration_ThenSetupFlip_ReachesCompletePending()
    {
        var response = await _authService.RegisterAsync(Request(AccountTypes.Photographer, "flip@example.com"));
        Assert.False(response.IsSetupComplete);

        var user = await _userManager.FindByEmailAsync("flip@example.com");
        Assert.NotNull(user);

        // The exact state CoordinatorSetupService commits after a successful submission.
        user!.IsSetupComplete = true;
        user.ApprovalStatus = AccountApprovalStatus.Pending;
        await _userManager.UpdateAsync(user);

        var reloaded = await _context.Users.AsNoTracking().SingleAsync(u => u.Email == "flip@example.com");
        Assert.True(reloaded.IsSetupComplete);
        Assert.Equal(AccountApprovalStatus.Pending, reloaded.ApprovalStatus);
    }

    public void Dispose()
    {
        _context.Database.EnsureDeleted();
        _context.Dispose();
        _provider.Dispose();
    }
}
