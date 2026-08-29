using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Auth;

public sealed class AuthService : IAuthService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ITokenService _tokenService;

    public AuthService(UserManager<ApplicationUser> userManager, ITokenService tokenService)
    {
        _userManager = userManager;
        _tokenService = tokenService;
    }

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

        // Validate AccountType is supported (reuse Mohammed's logic)
        if (request.AccountType != ApplicationRoles.RegisteredUser && request.AccountType != ApplicationRoles.HallOwner)
            throw new ValidationException(new Dictionary<string, string[]> { ["AccountType"] = new[] { $"Account type must be either '{ApplicationRoles.RegisteredUser}' or '{ApplicationRoles.HallOwner}'." } });

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

        var createResult = await _userManager.CreateAsync(user, request.Password);
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

        var roleResult = await _userManager.AddToRoleAsync(user, request.AccountType);
        if (!roleResult.Succeeded)
        {
            // Rollback user creation if role assignment fails
            await _userManager.DeleteAsync(user);
            var errors = roleResult.Errors.ToDictionary(e => e.Code, e => new[] { e.Description });
            throw new ValidationException(errors);
        }

        var roles = new[] { request.AccountType };
        var token = _tokenService.CreateToken(user.Id, user.UserName!, user.Email!, roles);

        return new RegisterResponse(
            user.Id,
            user.FullName,
            user.Email!,
            user.PhoneNumber!,
            request.AccountType,
            token);
    }
}
