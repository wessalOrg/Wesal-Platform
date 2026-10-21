using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Enums;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Auth;

public sealed class GoogleAuthService
{
    private readonly UserManager<ApplicationUser> _users;
    private readonly RoleManager<ApplicationRole> _roles;
    private readonly ITokenService _tokens;
    private readonly GoogleAuthSettings _settings;
    private readonly IHttpContextAccessor _http;
    private readonly IOptions<JwtSettings> _jwtSettings;

    public GoogleAuthService(UserManager<ApplicationUser> users, RoleManager<ApplicationRole> roles,
        ITokenService tokens, IOptions<GoogleAuthSettings> settings, IHttpContextAccessor http, IOptions<JwtSettings> jwtSettings)
    {
        _users = users;
        _roles = roles;
        _tokens = tokens;
        _settings = settings.Value;
        _http = http;
        _jwtSettings = jwtSettings;
    }

    public async Task<GoogleAuthResponse> LoginAsync(string credential, string accountType, CancellationToken ct)
    {
        var payload = await VerifyAsync(credential, ct);
        var user = await _users.FindByLoginAsync("Google", payload.Subject);
        if (user is null)
        {
            // Google has verified ownership of this email. Reuse an existing
            // local account with the same email by linking this Google identity.
            user = await _users.FindByEmailAsync(payload.Email);
            if (user is not null)
            {
                var linkResult = await _users.AddLoginAsync(user, new UserLoginInfo("Google", payload.Subject, "Google"));
                if (!linkResult.Succeeded)
                {
                    // Handle a concurrent link only when it belongs to this account.
                    var linkedUser = await _users.FindByLoginAsync("Google", payload.Subject);
                    if (linkedUser is null || linkedUser.Id != user.Id)
                        throw new ConflictException("Google account is already associated with another user.");
                    user = linkedUser;
                }
            }
            else
            {
                return new GoogleAuthResponse { RequiresRegistration = true, RegistrationToken = CreateRegistrationToken(payload), Email = payload.Email, GoogleName = payload.Name, AccountType = accountType };
            }
        }
        var roles = await _users.GetRolesAsync(user);
        return new GoogleAuthResponse { User = MakeLoginResponse(user, roles) };
    }

    public async Task<GoogleAuthResponse> RegisterAsync(GoogleRegisterRequest request, CancellationToken ct)
    {
        var registration = ValidateRegistrationToken(request.RegistrationToken ?? string.Empty);
        return await RegisterVerifiedAsync(registration.Subject, registration.Email, request.FullName, request.AccountType, ct);
    }

    private async Task<GoogleAuthResponse> RegisterVerifiedAsync(string subject, string email, string name, string accountType, CancellationToken ct)
    {
        var existing = await _users.FindByLoginAsync("Google", subject);
        if (existing is not null) return new GoogleAuthResponse { User = MakeLoginResponse(existing, await _users.GetRolesAsync(existing)) };
        if (await _users.FindByEmailAsync(email) is not null) throw new ConflictException("Email already exists.");
        if (string.IsNullOrWhiteSpace(name) || name.Trim().Length > 150)
            throw new ValidationException(new Dictionary<string, string[]> { ["FullName"] = ["Please enter a name (up to 150 characters)."] });
        var normalized = AccountTypes.IsValid(accountType) ? AccountTypes.Normalize(accountType) : ApplicationRoles.RegisteredUser;
        var role = AccountTypes.IsValid(normalized) ? AccountTypes.ToRole(normalized) : ApplicationRoles.RegisteredUser;
        var setup = AccountTypes.RequiresRoleSetup(normalized);
        var user = new ApplicationUser { FullName = name.Trim(), Email = email, UserName = email, EmailConfirmed = true,
            IsSetupComplete = !setup, ApprovalStatus = setup ? AccountApprovalStatus.Pending : AccountApprovalStatus.Approved };
        var result = await _users.CreateAsync(user);
        if (!result.Succeeded) throw new ValidationException(result.Errors.GroupBy(x => x.Code).ToDictionary(g => g.Key, g => g.Select(x => x.Description).ToArray()));
        if (!await _roles.RoleExistsAsync(role)) await _roles.CreateAsync(new ApplicationRole(role));
        var roleResult = await _users.AddToRoleAsync(user, role);
        var loginResult = roleResult.Succeeded ? await _users.AddLoginAsync(user, new UserLoginInfo("Google", subject, "Google")) : roleResult;
        if (!loginResult.Succeeded) { await _users.DeleteAsync(user); throw new ValidationException(loginResult.Errors.GroupBy(x => x.Code).ToDictionary(g => g.Key, g => g.Select(x => x.Description).ToArray())); }
        return new GoogleAuthResponse { User = MakeLoginResponse(user, [role]), AccountType = normalized };
    }

    private async Task<GoogleJsonWebSignature.Payload> VerifyAsync(string credential, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_settings.ClientId)) throw new InvalidOperationException("GoogleAuth:ClientId is not configured.");
        try
        {
            var payload = await GoogleJsonWebSignature.ValidateAsync(credential,
                new GoogleJsonWebSignature.ValidationSettings { Audience = [_settings.ClientId] });
            ct.ThrowIfCancellationRequested();
            if (string.IsNullOrWhiteSpace(payload.Email) || payload.EmailVerified != true)
                throw new UnauthorizedException("Google email must be verified.");
            return payload;
        }
        catch (InvalidJwtException) { throw new UnauthorizedException("Invalid Google credential."); }
    }

    private LoginResponse MakeLoginResponse(ApplicationUser user, IList<string> roles) => new()
    {
        Id = user.Id, FullName = user.FullName, Email = user.Email ?? string.Empty,
        Role = roles.FirstOrDefault() ?? ApplicationRoles.RegisteredUser,
        AccountType = AccountTypes.FromRole(roles.FirstOrDefault() ?? ApplicationRoles.RegisteredUser) ?? "RegisteredUser",
        Token = _tokens.CreateToken(user.Id, user.UserName ?? user.Email ?? string.Empty, user.Email ?? string.Empty, roles)
    };

    private string CreateRegistrationToken(Google.Apis.Auth.GoogleJsonWebSignature.Payload payload)
    {
        var settings = _jwtSettings.Value;
        var claims = new[] { new Claim("google_sub", payload.Subject), new Claim("google_email", payload.Email) };
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.SecretKey));
        var token = new JwtSecurityToken(settings.Issuer, settings.Audience, claims,
            expires: DateTime.UtcNow.AddMinutes(10), signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    // Implemented below using a short-lived JWT signed with the application's key.
    private (string Subject, string Email) ValidateRegistrationToken(string token)
    {
        var handler = new JwtSecurityTokenHandler();
        var settings = _jwtSettings.Value;
        var principal = handler.ValidateToken(token, JwtTokenValidationParametersFactory.Create(settings), out _);
        return (principal.FindFirstValue("google_sub")!, principal.FindFirstValue("google_email")!);
    }
}
