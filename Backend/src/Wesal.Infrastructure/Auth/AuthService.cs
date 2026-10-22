using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Text.Encodings.Web;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Constants;
using Wesal.Domain.Enums;
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

        // Validate AccountType is supported (reuse Mohammed's logic via AccountTypes)
        if (!AccountTypes.IsValid(request.AccountType) && request.AccountType != ApplicationRoles.RegisteredUser)
            throw new ValidationException(new Dictionary<string, string[]> { ["AccountType"] = new[] { $"Account type must be one of: {string.Join(", ", AccountTypes.All)}." } });

        var normalizedAccountType = AccountTypes.IsValid(request.AccountType) ? AccountTypes.Normalize(request.AccountType) : request.AccountType!;
        var role = AccountTypes.IsValid(request.AccountType) ? AccountTypes.ToRole(request.AccountType) : request.AccountType!;

        // Event Coordinators and Photographers are NOT fully registered at account
        // creation: their registration completes only after the role-specific setup
        // submission, and they must never be auto-approved. Regular users and hall
        // owners keep their original behaviour (complete and approved immediately).
        var requiresRoleSetup = AccountTypes.RequiresRoleSetup(request.AccountType);

        // Ensure password confirmation (defense in depth)
        if (request.Password != request.ConfirmPassword)
            throw new ValidationException(new Dictionary<string, string[]> { ["ConfirmPassword"] = new[] { "Password and confirm password do not match." } });

        var user = new ApplicationUser
        {
            FullName = request.FullName.Trim(),
            Email = request.Email.Trim(),
            UserName = request.Email.Trim(),
            IsSetupComplete = !requiresRoleSetup,
            ApprovalStatus = requiresRoleSetup
                ? AccountApprovalStatus.Pending
                : AccountApprovalStatus.Approved
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
            AccountType = normalizedAccountType,
            Role = role,
            Token = token,
            IsSetupComplete = user.IsSetupComplete,
            ApprovalStatus = user.ApprovalStatus
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
            var encodedResetUrl = HtmlEncoder.Default.Encode(resetUrl);
            var encodedFullName = HtmlEncoder.Default.Encode(user.FullName);
            var logoUrl = HtmlEncoder.Default.Encode(
                $"{_passwordResetOptions.FrontendBaseUrl.Trim().TrimEnd('/')}/logo-wesal-white.png");
            var plainBody = $"مرحبًا {user.FullName}،\n\nتلقينا طلبًا لإعادة تعيين كلمة مرور حسابك في وصال. افتح الرابط التالي خلال 24 ساعة لاختيار كلمة مرور جديدة:\n\n{resetUrl}\n\nإذا لم تطلب إعادة التعيين، يمكنك تجاهل هذه الرسالة.\n\n---\n\nHello {user.FullName},\nWe received a request to reset your Wesal password. Open the link below within 24 hours to choose a new password:\n\n{resetUrl}\n\nIf you did not request this, you can safely ignore this email.";
            var htmlBody = $"""
                <!doctype html>
                <html lang="ar" dir="rtl">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <meta name="color-scheme" content="light">
                  <title>إعادة تعيين كلمة مرور وصال</title>
                </head>
                <body style="margin:0;padding:0;background-color:#f6f1ec;font-family:Arial,Tahoma,sans-serif;color:#3d342e">
                  <div style="display:none;max-height:0;overflow:hidden;opacity:0">اختر كلمة مرور جديدة وآمنة لحسابك في وصال.</div>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f6f1ec">
                    <tr><td align="center" style="padding:36px 16px">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:#ffffff;border:1px solid #eee6de;border-radius:20px;overflow:hidden">
                        <tr><td align="center" style="padding:30px 24px 26px;background-color:#c17b7f">
                          <img src="{logoUrl}" width="86" height="86" alt="شعار وصال" style="display:block;width:86px;height:86px;object-fit:contain;border-radius:18px;background-color:#c17b7f">
                          <p style="margin:14px 0 0;color:#ffffff;font-size:24px;font-weight:bold;letter-spacing:1px">وصال</p>
                          <p dir="ltr" style="margin:5px 0 0;color:#fff8f6;font-size:13px;letter-spacing:2px">WESAL</p>
                        </td></tr>
                        <tr><td align="center" style="padding:34px 32px 18px">
                          <div style="width:54px;height:54px;line-height:54px;border-radius:50%;background-color:#f5e8e4;color:#a86267;font-size:25px;font-weight:bold">↻</div>
                          <h1 style="margin:20px 0 12px;color:#a86267;font-size:25px;line-height:1.5">إعادة تعيين كلمة المرور</h1>
                          <p style="margin:0;color:#3d342e;font-size:16px;line-height:1.9">مرحبًا {encodedFullName}،</p>
                          <p style="margin:8px 0 0;color:#8a7a70;font-size:15px;line-height:1.9">تلقينا طلبًا لإعادة تعيين كلمة مرور حسابك. اضغط الزر أدناه لاختيار كلمة مرور جديدة وآمنة.</p>
                          <p style="margin:12px 0 0;color:#8a7a70;font-size:13px">لأمان حسابك، تنتهي صلاحية الرابط خلال 24 ساعة.</p>
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px auto 20px"><tr><td align="center" bgcolor="#c17b7f" style="border-radius:12px">
                            <a href="{encodedResetUrl}" style="display:inline-block;padding:15px 32px;border:1px solid #c17b7f;border-radius:12px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold">إعادة تعيين كلمة المرور</a>
                          </td></tr></table>
                          <div dir="ltr" style="margin:0 auto 24px;max-width:440px">
                            <p style="margin:0;color:#3d342e;font-size:15px;line-height:1.8">Hello {encodedFullName},</p>
                            <p style="margin:6px 0 0;color:#8a7a70;font-size:14px;line-height:1.8">We received a request to reset your Wesal password. Use the button below to choose a new, secure password. This link expires in 24 hours.</p>
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px auto 0"><tr><td align="center" bgcolor="#c17b7f" style="border-radius:12px">
                              <a href="{encodedResetUrl}" style="display:inline-block;padding:13px 30px;border:1px solid #c17b7f;border-radius:12px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold">Reset password</a>
                            </td></tr></table>
                          </div>
                          <p style="margin:0;color:#8a7a70;font-size:13px;line-height:1.8">إذا لم يعمل الزر، انسخ الرابط التالي والصقه في متصفحك:</p>
                          <p dir="ltr" style="margin:10px 0 0;padding:12px;background-color:#fcf9f7;border:1px solid #eee6de;border-radius:10px;overflow-wrap:anywhere;text-align:left;font-size:12px;line-height:1.7"><a href="{encodedResetUrl}" style="color:#a86267;text-decoration:underline">{encodedResetUrl}</a></p>
                          <div style="height:1px;margin:26px 0;background-color:#eee6de"></div>
                          <p style="margin:0;color:#8a7a70;font-size:13px;line-height:1.8">إذا لم تطلب إعادة تعيين كلمة المرور، تجاهل هذه الرسالة. سيبقى حسابك آمنًا.</p>
                        </td></tr>
                        <tr><td align="center" style="padding:20px 24px;background-color:#fcf9f7;border-top:1px solid #eee6de">
                          <p dir="ltr" style="margin:0;color:#8a7a70;font-size:13px">Need help? Wesal Account Security</p>
                          <p style="margin:7px 0 0;color:#a89b92;font-size:12px">© وصال | WESAL</p>
                        </td></tr>
                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
                """;

            var sent = await _emailService.TrySendAsync(
                user.Email,
                "إعادة تعيين كلمة مرور وصال | Reset your Wesal password",
                plainBody,
                user.FullName,
                htmlBody,
                cancellationToken);

            if (!sent)
            {
                _logger.LogWarning(
                    "Password reset link could not be delivered to {Email}. Check the configured email provider settings so reset emails reach users.",
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
