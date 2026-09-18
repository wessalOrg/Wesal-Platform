using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Auth;

public sealed class AuthService : IAuthService
{
    private const string InvalidResetLinkMessage = "This password reset link is invalid or has expired.";
    private const string GenericForgotPasswordMessage =
        "If an account exists for that email, a password reset link has been sent.";

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<ApplicationRole> _roleManager;
    private readonly ITokenService _tokenService;
    private readonly IEmailService _emailService;
    private readonly PasswordResetOptions _passwordResetOptions;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        UserManager<ApplicationUser> userManager,
        RoleManager<ApplicationRole> roleManager,
        ITokenService tokenService,
        IEmailService emailService,
        IOptions<PasswordResetOptions> passwordResetOptions,
        ILogger<AuthService> logger)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _tokenService = tokenService;
        _emailService = emailService;
        _passwordResetOptions = passwordResetOptions.Value;
        _logger = logger;
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

    public async Task<ForgotPasswordResponse> ForgotPasswordAsync(
        ForgotPasswordRequest request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var email = request.Email.Trim();

        var user = await _userManager.FindByEmailAsync(email);
        if (user is not null && !string.IsNullOrWhiteSpace(user.Email))
        {
            var token = await _userManager.GeneratePasswordResetTokenAsync(user);
            var resetUrl = BuildResetUrl(user.Email, token);

            var sent = await _emailService.TrySendAsync(
                user.Email,
                "Reset your Wesal password",
                $"You requested a password reset for your Wesal account. Open the link below within the next 24 hours to choose a new password:\n\n{resetUrl}\n\nIf you did not request this, you can safely ignore this email.",
                cancellationToken);

            if (!sent)
            {
                _logger.LogWarning(
                    "Password reset link could not be delivered to {Email}. Configure Email:Host (SMTP) so reset emails reach users.",
                    user.Email);
            }
        }

        // Always return the same message so the endpoint cannot be used to probe
        // whether an email address is registered.
        return new ForgotPasswordResponse { Message = GenericForgotPasswordMessage };
    }

    public async Task<ResetPasswordResponse> ResetPasswordAsync(
        ResetPasswordRequest request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var email = request.Email.Trim();

        if (request.NewPassword != request.ConfirmPassword)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["ConfirmPassword"] = new[] { "Password and confirm password do not match." }
            });
        }

        var user = await _userManager.FindByEmailAsync(email);
        if (user is null)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Token"] = new[] { InvalidResetLinkMessage }
            });
        }

        var resetResult = await _userManager.ResetPasswordAsync(user, request.Token, request.NewPassword);
        if (!resetResult.Succeeded)
        {
            var passwordErrors = resetResult.Errors
                .Where(error => IsPasswordPolicyError(error.Code))
                .ToList();

            if (passwordErrors.Count > 0)
            {
                throw new ValidationException(new Dictionary<string, string[]>
                {
                    ["NewPassword"] = passwordErrors.Select(error => error.Description).ToArray()
                });
            }

            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Token"] = new[] { InvalidResetLinkMessage }
            });
        }

        // The user may have been locked out before requesting a reset; a successful
        // reset is a strong proof of ownership, so clear any pending lockout and
        // rotate the security stamp so previously issued reset tokens no longer work.
        await _userManager.ResetAccessFailedCountAsync(user);
        await _userManager.UpdateSecurityStampAsync(user);

        return new ResetPasswordResponse
        {
            Message = "Your password has been reset. You can now sign in with your new password."
        };
    }

    private string BuildResetUrl(string email, string token)
    {
        var baseUrl = _passwordResetOptions.FrontendBaseUrl.Trim().TrimEnd('/');

        if (baseUrl.Length == 0)
        {
            _logger.LogWarning(
                "PasswordReset:FrontendBaseUrl is not configured; the reset email will contain a relative link. Set it before going to production.");
            baseUrl = string.Empty;
        }

        return $"{baseUrl}/reset-password?email={Uri.EscapeDataString(email)}&token={Uri.EscapeDataString(token)}";
    }

    private static bool IsPasswordPolicyError(string code)
        => code.StartsWith("PasswordRequires", StringComparison.OrdinalIgnoreCase)
            || code.Equals("PasswordTooShort", StringComparison.OrdinalIgnoreCase)
            || code.Equals("PasswordMismatch", StringComparison.OrdinalIgnoreCase);

    private async Task EnsureRoleExistsAsync(string role, CancellationToken cancellationToken)
    {
        if (await _roleManager.RoleExistsAsync(role))
            return;
        var createResult = await _roleManager.CreateAsync(new ApplicationRole(role));
        if (!createResult.Succeeded)
            throw new DomainException("Failed to prepare the requested account type.");
    }
}
