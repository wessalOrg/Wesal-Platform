using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Identity;

namespace Wesal.Infrastructure.Auth;

public sealed class PasswordResetService : IPasswordResetService
{
    private const string UnregisteredEmailMessage = "Email is not registered.";

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IPasswordResetLinkSender _resetLinkSender;
    private readonly PasswordResetOptions _options;

    public PasswordResetService(
        UserManager<ApplicationUser> userManager,
        IPasswordResetLinkSender resetLinkSender,
        IOptions<PasswordResetOptions> options)
    {
        _userManager = userManager;
        _resetLinkSender = resetLinkSender;
        _options = options.Value;
    }

    public async Task<ForgotPasswordResponse> ForgotPasswordAsync(
        ForgotPasswordRequest request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var email = request.Email.Trim();

        var user = await _userManager.FindByEmailAsync(email);
        if (user is null)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Email"] = new[] { UnregisteredEmailMessage }
            });
        }

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);

        var resetLink = BuildResetLink(email, token);

        await _resetLinkSender.SendResetLinkAsync(email, resetLink, cancellationToken);

        return new ForgotPasswordResponse
        {
            Message = "A password reset link has been sent to your email address."
        };
    }

    public async Task<ResetPasswordResponse> ResetPasswordAsync(
        ResetPasswordRequest request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var email = request.Email.Trim();

        var user = await _userManager.FindByEmailAsync(email);
        if (user is null)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Email"] = new[] { UnregisteredEmailMessage }
            });
        }

        var result = await _userManager.ResetPasswordAsync(user, request.Token.Trim(), request.NewPassword);
        if (!result.Succeeded)
        {
            var passwordErrors = result.Errors
                .Where(error => error.Code.StartsWith("Password", StringComparison.Ordinal))
                .Select(error => error.Description)
                .ToArray();

            if (passwordErrors.Length > 0)
            {
                throw new ValidationException(new Dictionary<string, string[]>
                {
                    ["NewPassword"] = passwordErrors
                });
            }

            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Token"] = new[]
                {
                    "The password reset link is invalid, expired, or has already been used. Please request a new one."
                }
            });
        }

        return new ResetPasswordResponse
        {
            Message = "Your password has been reset. You can now log in with your new password."
        };
    }

    private string BuildResetLink(string email, string token)
        => $"{_options.ResetPageUrl}?email={Uri.EscapeDataString(email)}&token={Uri.EscapeDataString(token)}";
}