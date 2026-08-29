using Microsoft.AspNetCore.Identity;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Auth;

public sealed class LoginService : ILoginService
{
    private const string AccountBlockedCode = "AccountBlocked";

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ITokenService _tokenService;
    private readonly IDateTime _dateTime;

    public LoginService(
        UserManager<ApplicationUser> userManager,
        ITokenService tokenService,
        IDateTime dateTime)
    {
        _userManager = userManager;
        _tokenService = tokenService;
        _dateTime = dateTime;
    }

    public async Task<LoginResponse> LoginAsync(
        LoginRequest request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var identifier = request.Identifier.Trim();

        var user = await FindUserByIdentifierAsync(identifier);
        if (user is null)
        {
            throw new UnauthorizedException("Invalid identifiers or password.");
        }

        if (await _userManager.IsLockedOutAsync(user))
        {
            await ThrowForBlockedAccountAsync(user);
        }

        if (!await _userManager.CheckPasswordAsync(user, request.Password))
        {
            await _userManager.AccessFailedAsync(user);

            if (await _userManager.IsLockedOutAsync(user))
            {
                await ThrowForBlockedAccountAsync(user);
            }

            throw new UnauthorizedException("Invalid identifiers or password.");
        }

        await _userManager.ResetAccessFailedCountAsync(user);

        var roles = await _userManager.GetRolesAsync(user);
        var primaryRole = roles.FirstOrDefault(role => AccountTypes.FromRole(role) is not null)
            ?? roles.FirstOrDefault()
            ?? string.Empty;

        var token = _tokenService.CreateToken(
            user.Id,
            user.UserName ?? user.Email ?? string.Empty,
            user.Email ?? string.Empty,
            roles);

        return new LoginResponse
        {
            Token = token,
            Id = user.Id,
            FullName = user.FullName,
            Email = user.Email ?? string.Empty,
            PhoneNumber = user.PhoneNumber ?? string.Empty,
            AccountType = AccountTypes.FromRole(primaryRole) ?? string.Empty,
            Role = primaryRole
        };
    }

    private async Task<ApplicationUser?> FindUserByIdentifierAsync(string identifier)
    {
        if (identifier.Contains('@'))
        {
            return await _userManager.FindByEmailAsync(identifier);
        }

        return _userManager.Users.FirstOrDefault(user => user.PhoneNumber == identifier);
    }

    private async Task ThrowForBlockedAccountAsync(ApplicationUser user)
    {
        var lockoutEnd = await _userManager.GetLockoutEndDateAsync(user);
        var now = _dateTime.Now;

        var remaining = lockoutEnd.HasValue && lockoutEnd.Value > now
            ? lockoutEnd.Value - now
            : TimeSpan.Zero;

        var minutes = Math.Max(1, (int)Math.Ceiling(remaining.TotalMinutes));

        throw new BusinessRuleException(
            AccountBlockedCode,
            $"Your account is temporarily blocked. Try again in approximately {minutes} minute(s).");
    }
}