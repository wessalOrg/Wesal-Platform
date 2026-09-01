using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Auth;

public sealed class AuthService : IAuthService, IRegistrationService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<ApplicationRole> _roleManager;
    private readonly ITokenService _tokenService;

    public AuthService(UserManager<ApplicationUser> userManager, RoleManager<ApplicationRole> roleManager, ITokenService tokenService)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _tokenService = tokenService;
    }

    // IRegistrationService explicit implementation delegates to IAuthService
    async Task<RegisterResponse> IRegistrationService.RegisterAsync(RegisterRequest request, CancellationToken cancellationToken)
        => await RegisterAsync(request, cancellationToken);

    public async Task<RegisterResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default)
    {
        // Duplicate Email check
        var existingByEmail = await _userManager.FindByEmailAsync(request.Email);
        if (existingByEmail is not null)
            throw new ConflictException("Email already exists.");

        // Duplicate Phone check
        var normalizedPhone = request.PhoneNumber.Trim();
        var existingByPhone = await _userManager.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.PhoneNumber == normalizedPhone, cancellationToken);
        if (existingByPhone is not null)
            throw new ConflictException("Phone number already exists.");

        // Validate AccountType is supported (reuse Mohammed's logic via AccountTypes)
        if (!AccountTypes.IsValid(request.AccountType) && request.AccountType != ApplicationRoles.RegisteredUser)
            throw new ValidationException(new Dictionary<string, string[]> { ["AccountType"] = new[] { $"Account type must be one of: {string.Join(", ", AccountTypes.All)}." } });

        var normalizedAccountType = AccountTypes.IsValid(request.AccountType) ? AccountTypes.Normalize(request.AccountType) : request.AccountType!;
        var role = AccountTypes.IsValid(request.AccountType) ? AccountTypes.ToRole(request.AccountType) : request.AccountType!;

        // Ensure password confirmation (defense in depth)
        if (request.Password != request.ConfirmPassword)
            throw new ValidationException(new Dictionary<string, string[]> { ["ConfirmPassword"] = new[] { "Password and confirm password do not match." } });

        var user = new ApplicationUser
        {
            FullName = request.FullName.Trim(),
            Email = request.Email.Trim(),
            UserName = request.Email.Trim(),
            PhoneNumber = normalizedPhone
        };

        IdentityResult createResult;
        try
        {
            createResult = await _userManager.CreateAsync(user, request.Password);
        }
        catch (DbUpdateException ex) when (ex.InnerException?.Message.Contains("PhoneNumber") == true || ex.Message.Contains("PhoneNumber"))
        {
            throw new ConflictException("Phone number already exists.");
        }

        if (!createResult.Succeeded)
        {
            var errors = createResult.Errors
                .GroupBy(e => e.Code)
                .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray());

            // Map Identity errors to validation exception
            // If no specific grouping, use first error
            if (errors.Count == 0)
                errors = new Dictionary<string, string[]> { ["Password"] = new[] { "Password does not meet requirements." } };

            throw new ValidationException(errors);
        }

        await EnsureRoleExistsAsync(role, cancellationToken);

        var roleResult = await _userManager.AddToRoleAsync(user, role);
        if (!roleResult.Succeeded)
        {
            // Rollback user creation if role assignment fails
            await _userManager.DeleteAsync(user);
            var errors = roleResult.Errors.ToDictionary(e => e.Code, e => new[] { e.Description });
            throw new ValidationException(errors);
        }

        var roles = new[] { role };
        var token = _tokenService.CreateToken(user.Id, user.UserName!, user.Email!, roles);

        return new RegisterResponse
        {
            Id = user.Id,
            FullName = user.FullName,
            Email = user.Email!,
            PhoneNumber = user.PhoneNumber!,
            AccountType = normalizedAccountType,
            Role = role,
            Token = token
        };
    }

    private async Task EnsureRoleExistsAsync(string role, CancellationToken cancellationToken)
    {
        if (await _roleManager.RoleExistsAsync(role))
            return;
        var createResult = await _roleManager.CreateAsync(new ApplicationRole(role));
        if (!createResult.Succeeded)
            throw new DomainException("Failed to prepare the requested account type.");
    }
}
