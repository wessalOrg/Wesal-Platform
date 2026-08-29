using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Registration;

public sealed class RegistrationService : IRegistrationService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<ApplicationRole> _roleManager;

    public RegistrationService(
        UserManager<ApplicationUser> userManager,
        RoleManager<ApplicationRole> roleManager)
    {
        _userManager = userManager;
        _roleManager = roleManager;
    }

    public async Task<RegisterResponse> RegisterAsync(
        RegisterRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!AccountTypes.IsValid(request.AccountType))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                [nameof(RegisterRequest.AccountType)] = [$"Account type must be one of: {string.Join(", ", AccountTypes.All)}."]
            });
        }

        var role = AccountTypes.ToRole(request.AccountType);
        await EnsureRoleExistsAsync(role, cancellationToken);

        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            FullName = request.FullName.Trim(),
            PhoneNumber = request.PhoneNumber.Trim()
        };

        var createResult = await _userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            ThrowForCreateErrors(createResult.Errors);
        }

        var roleResult = await _userManager.AddToRoleAsync(user, role);
        if (!roleResult.Succeeded)
        {
            await _userManager.DeleteAsync(user);
            throw new DomainException("Failed to assign the requested account type to the new user.");
        }

        return new RegisterResponse
        {
            Id = user.Id,
            FullName = user.FullName,
            Email = user.Email ?? request.Email,
            PhoneNumber = user.PhoneNumber ?? request.PhoneNumber,
            AccountType = AccountTypes.Normalize(request.AccountType),
            Role = role
        };
    }

    private async Task EnsureRoleExistsAsync(string role, CancellationToken cancellationToken)
    {
        if (await _roleManager.RoleExistsAsync(role))
        {
            return;
        }

        var createResult = await _roleManager.CreateAsync(new ApplicationRole(role));
        if (!createResult.Succeeded)
        {
            throw new DomainException("Failed to prepare the requested account type.");
        }
    }

    private static void ThrowForCreateErrors(IEnumerable<IdentityError> errors)
    {
        var error = errors.FirstOrDefault();
        if (error is null)
        {
            return;
        }

        if (error.Code is "DuplicateUserName" or "DuplicateEmail")
        {
            throw new ConflictException("An account with this email is already registered.");
        }

        throw new ValidationException(new Dictionary<string, string[]>
        {
            [FieldForKey(error.Code)] = [error.Description]
        });
    }

    private static string FieldForKey(string errorCode) => errorCode switch
    {
        "InvalidEmail" => nameof(RegisterRequest.Email),
        "PasswordTooShort"
            or "PasswordRequiresDigit"
            or "PasswordRequiresUpper"
            or "PasswordRequiresLower"
            or "PasswordRequiresNonAlphanumeric" => nameof(RegisterRequest.Password),
        _ => nameof(RegisterRequest)
    };
}