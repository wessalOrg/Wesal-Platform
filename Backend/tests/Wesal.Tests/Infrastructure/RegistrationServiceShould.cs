using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;
using Wesal.Infrastructure.Registration;
using Wesal.Persistence.Data;

namespace Wesal.Tests.Infrastructure;

public class RegistrationServiceShould
{
    private static RegisterRequest CreateRequest(
        string fullName = "Omar Khaled",
        string email = "omar.khaled@example.com",
        string phoneNumber = "+970599123456",
        string password = "Password123!",
        string? accountType = AccountTypes.RegularUser) => new()
    {
        FullName = fullName,
        Email = email,
        PhoneNumber = phoneNumber,
        Password = password,
        ConfirmPassword = password,
        AccountType = accountType
    };

    private static (RegistrationService Service, ApplicationDbContext Context) CreateService()
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

        return (new RegistrationService(userManager, roleManager), context);
    }

    [Fact]
    public async Task Register_RegularUser_CreatesUserWithRegisteredUserRole()
    {
        var (service, context) = CreateService();

        var response = await service.RegisterAsync(CreateRequest(email: "regular@example.com", accountType: AccountTypes.RegularUser));

        Assert.Equal(AccountTypes.RegularUser, response.AccountType);
        Assert.Equal(ApplicationRoles.RegisteredUser, response.Role);
        Assert.Equal("regular@example.com", response.Email);
        Assert.Equal("Omar Khaled", response.FullName);
        Assert.Equal("+970599123456", response.PhoneNumber);
        Assert.False(string.IsNullOrEmpty(response.Id));

        var user = await context.Users.SingleAsync(item => item.Email == "regular@example.com");
        Assert.Equal("Omar Khaled", user.FullName);
        Assert.Equal("+970599123456", user.PhoneNumber);

        var userRole = await context.UserRoles.SingleAsync(item => item.UserId == user.Id);
        var roleName = await context.Roles.SingleAsync(item => item.Id == userRole.RoleId);
        Assert.Equal(ApplicationRoles.RegisteredUser, roleName.Name);
    }

    [Fact]
    public async Task Register_HallOwner_CreatesUserWithHallOwnerRole()
    {
        var (service, context) = CreateService();

        var response = await service.RegisterAsync(CreateRequest(email: "owner@example.com", accountType: AccountTypes.HallOwner));

        Assert.Equal(AccountTypes.HallOwner, response.AccountType);
        Assert.Equal(ApplicationRoles.HallOwner, response.Role);
        Assert.False(string.IsNullOrEmpty(response.Id));

        var user = await context.Users.SingleAsync(item => item.Email == "owner@example.com");
        var userRole = await context.UserRoles.SingleAsync(item => item.UserId == user.Id);
        var roleName = await context.Roles.SingleAsync(item => item.Id == userRole.RoleId);
        Assert.Equal(ApplicationRoles.HallOwner, roleName.Name);
    }

    [Fact]
    public async Task Register_CaseInsensitiveAccountType_NormalizesAndAssignsMatchingRole()
    {
        var (service, context) = CreateService();

        var response = await service.RegisterAsync(CreateRequest(email: "mixed@example.com", accountType: "hallowner"));

        Assert.Equal(AccountTypes.HallOwner, response.AccountType);
        Assert.Equal(ApplicationRoles.HallOwner, response.Role);

        var user = await context.Users.SingleAsync(item => item.Email == "mixed@example.com");
        var userRole = await context.UserRoles.SingleAsync(item => item.UserId == user.Id);
        var roleName = await context.Roles.SingleAsync(item => item.Id == userRole.RoleId);
        Assert.Equal(ApplicationRoles.HallOwner, roleName.Name);
    }

    [Fact]
    public async Task Register_InvalidAccountType_ThrowsValidationExceptionAndCreatesNoUser()
    {
        var (service, context) = CreateService();

        var exception = await Assert.ThrowsAsync<ValidationException>(() =>
            service.RegisterAsync(CreateRequest(email: "invalid@example.com", accountType: "Admin")));

        Assert.Contains(nameof(RegisterRequest.AccountType), exception.Errors.Keys);
        Assert.Empty(context.Users);
    }

    [Fact]
    public async Task Register_NullAccountType_ThrowsValidationExceptionAndCreatesNoUser()
    {
        var (service, context) = CreateService();

        var exception = await Assert.ThrowsAsync<ValidationException>(() =>
            service.RegisterAsync(CreateRequest(email: "null@example.com", accountType: null)));

        Assert.Contains(nameof(RegisterRequest.AccountType), exception.Errors.Keys);
        Assert.Empty(context.Users);
    }

    [Fact]
    public async Task Register_DuplicateEmail_ThrowsConflictExceptionAndCreatesOneUserOnly()
    {
        var (service, context) = CreateService();
        var first = await service.RegisterAsync(CreateRequest(email: "dupe@example.com", accountType: AccountTypes.RegularUser));
        Assert.False(string.IsNullOrEmpty(first.Id));

        var exception = await Assert.ThrowsAsync<ConflictException>(() =>
            service.RegisterAsync(CreateRequest(email: "dupe@example.com", accountType: AccountTypes.HallOwner)));

        Assert.Equal(1, context.Users.Count());
    }

    [Fact]
    public async Task Register_InvalidPasswordDirectSubmission_MapsAllViolationsToPasswordErrorsAndCreatesNoUser()
    {
        var (service, context) = CreateService();

        var exception = await Assert.ThrowsAsync<ValidationException>(() =>
            service.RegisterAsync(CreateRequest(email: "weak@example.com", password: "weak", accountType: AccountTypes.RegularUser)));

        Assert.True(exception.Errors.TryGetValue(nameof(RegisterRequest.Password), out var passwordErrors));
        Assert.Equal(4, passwordErrors.Length);
        Assert.Empty(context.Users);
    }

    [Fact]
    public async Task Register_WeakPassword_RejectedForBothAccountTypesWithoutCreatingUser()
    {
        var (service, context) = CreateService();

        var regularException = await Assert.ThrowsAsync<ValidationException>(() =>
            service.RegisterAsync(CreateRequest(email: "regular@example.com", password: "weak", accountType: AccountTypes.RegularUser)));
        var ownerException = await Assert.ThrowsAsync<ValidationException>(() =>
            service.RegisterAsync(CreateRequest(email: "owner@example.com", password: "weak", accountType: AccountTypes.HallOwner)));

        Assert.Contains(nameof(RegisterRequest.Password), regularException.Errors.Keys);
        Assert.Contains(nameof(RegisterRequest.Password), ownerException.Errors.Keys);
        Assert.Empty(context.Users);
    }

    [Fact]
    public async Task Register_SecondUserWithDifferentAccountType_DoesNotAffectExistingRole()
    {
        var (service, context) = CreateService();
        await service.RegisterAsync(CreateRequest(email: "first@example.com", accountType: AccountTypes.RegularUser));
        await service.RegisterAsync(CreateRequest(email: "second@example.com", accountType: AccountTypes.HallOwner));

        var firstUser = await context.Users.SingleAsync(item => item.Email == "first@example.com");
        var firstUserRole = await context.UserRoles.SingleAsync(item => item.UserId == firstUser.Id);
        var firstRoleName = await context.Roles.SingleAsync(item => item.Id == firstUserRole.RoleId);
        Assert.Equal(ApplicationRoles.RegisteredUser, firstRoleName.Name);
    }
}