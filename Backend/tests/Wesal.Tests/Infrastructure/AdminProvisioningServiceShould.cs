using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Domain.Constants;
using Wesal.Infrastructure.Identity;
using Wesal.Persistence.Data;

namespace Wesal.Tests.Infrastructure;

public class AdminProvisioningServiceShould
{
    private const string OriginalPassword = "OriginalPassword1!";
    private const string ProvisioningPassword = "ProvisioningPassword2@";

    private static (AdminProvisioningService Service, UserManager<ApplicationUser> UserManager, RoleManager<ApplicationRole> RoleManager, ApplicationDbContext Context) CreateService()
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

        var service = new AdminProvisioningService(userManager, roleManager, NullLogger<AdminProvisioningService>.Instance);

        return (service, userManager, roleManager, context);
    }

    private static AdminProvisioningEntry Entry(string email, string password) => new()
    {
        Email = email,
        FullName = "Admin Name",
        Password = password
    };

    [Fact]
    public async Task Provision_NewAccount_CreatesUserWithAdminRole()
    {
        var (service, userManager, _, context) = CreateService();
        const string email = "admin-new@wesal.com";

        await service.RunAsync([Entry(email, ProvisioningPassword)]);

        var user = await userManager.FindByEmailAsync(email);
        Assert.NotNull(user);
        Assert.Equal("Admin Name", user.FullName);
        Assert.True(await userManager.IsInRoleAsync(user!, ApplicationRoles.Admin));
        Assert.False(string.IsNullOrWhiteSpace(user!.PasswordHash));
        Assert.NotEqual(ProvisioningPassword, user.PasswordHash);
        Assert.Equal(1, await context.Users.CountAsync(candidate => candidate.Email == email));
    }

    [Fact]
    public async Task Provision_RunTwice_DoesNotDuplicateTheAccount()
    {
        var (service, userManager, _, context) = CreateService();
        const string email = "admin-idempotent@wesal.com";

        await service.RunAsync([Entry(email, ProvisioningPassword)]);
        await service.RunAsync([Entry(email, ProvisioningPassword)]);

        var user = await userManager.FindByEmailAsync(email);
        Assert.NotNull(user);
        Assert.True(await userManager.IsInRoleAsync(user!, ApplicationRoles.Admin));
        Assert.Equal(1, await context.Users.CountAsync(candidate => candidate.Email == email));
    }

    [Fact]
    public async Task Provision_ExistingAdmin_LeavesAccountAndPasswordIntact()
    {
        var (service, userManager, _, context) = CreateService();
        const string email = "admin-existing@wesal.com";

        await service.RunAsync([Entry(email, ProvisioningPassword)]);
        await service.RunAsync([Entry(email, "ACompletelyDifferentPassword3!")]);

        var user = await userManager.FindByEmailAsync(email);
        Assert.NotNull(user);
        Assert.True(await userManager.IsInRoleAsync(user!, ApplicationRoles.Admin));
        Assert.True(await userManager.CheckPasswordAsync(user!, ProvisioningPassword));
        Assert.False(await userManager.CheckPasswordAsync(user!, "ACompletelyDifferentPassword3!"));
        Assert.Equal(1, await context.Users.CountAsync(candidate => candidate.Email == email));
    }

    [Fact]
    public async Task Provision_ExistingUserWithoutAdmin_OnlyAddsTheAdminRole()
    {
        var (service, userManager, roleManager, context) = CreateService();
        const string email = "regular-turned-admin@wesal.com";

        await roleManager.CreateAsync(new ApplicationRole(ApplicationRoles.RegisteredUser));
        var existing = new ApplicationUser
        {
            FullName = "Original Owner",
            Email = email,
            UserName = email
        };
        var createResult = await userManager.CreateAsync(existing, OriginalPassword);
        Assert.True(createResult.Succeeded);
        var roleResult = await userManager.AddToRoleAsync(existing, ApplicationRoles.RegisteredUser);
        Assert.True(roleResult.Succeeded);

        await service.RunAsync([Entry(email, ProvisioningPassword)]);

        var user = await userManager.FindByEmailAsync(email);
        Assert.NotNull(user);
        Assert.True(await userManager.IsInRoleAsync(user!, ApplicationRoles.Admin));
        Assert.True(await userManager.IsInRoleAsync(user!, ApplicationRoles.RegisteredUser));
        Assert.Equal("Original Owner", user!.FullName);
        Assert.True(await userManager.CheckPasswordAsync(user, OriginalPassword));
        Assert.Equal(1, await context.Users.CountAsync(candidate => candidate.Email == email));
    }

    [Fact]
    public async Task Provision_MissingPassword_DoesNotCreateTheAccount()
    {
        var (service, _, _, context) = CreateService();
        const string email = "admin-no-password@wesal.com";

        await service.RunAsync([Entry(email, string.Empty)]);

        Assert.Equal(0, await context.Users.CountAsync(candidate => candidate.Email == email));
    }

    [Fact]
    public async Task Provision_AdminRoleMissing_CreatesTheAdminRole()
    {
        var (service, userManager, roleManager, _) = CreateService();

        Assert.False(await roleManager.RoleExistsAsync(ApplicationRoles.Admin));

        await service.RunAsync([Entry("admin-role-create@wesal.com", ProvisioningPassword)]);

        Assert.True(await roleManager.RoleExistsAsync(ApplicationRoles.Admin));
        var user = await userManager.FindByEmailAsync("admin-role-create@wesal.com");
        Assert.True(await userManager.IsInRoleAsync(user!, ApplicationRoles.Admin));
    }

    [Fact]
    public async Task Provision_EntryWithoutEmail_IsSkipped()
    {
        var (service, _, _, context) = CreateService();
        const string email = "admin-valid@wesal.com";

        await service.RunAsync(
        [
            Entry(string.Empty, ProvisioningPassword),
            Entry(email, ProvisioningPassword)
        ]);

        Assert.Equal(0, await context.Users.CountAsync(candidate => candidate.Email == string.Empty));
        Assert.Equal(1, await context.Users.CountAsync(candidate => candidate.Email == email));
    }
}