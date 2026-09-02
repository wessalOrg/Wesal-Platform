using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;

namespace Wesal.Infrastructure.Auth;

/// <summary>
/// Dev/preview sender that writes the reset link to the application log.
/// Replace with a real SMTP/HTTP provider in production.
/// </summary>
public sealed class LoggingPasswordResetLinkSender : IPasswordResetLinkSender
{
    private readonly ILogger<LoggingPasswordResetLinkSender> _logger;

    public LoggingPasswordResetLinkSender(ILogger<LoggingPasswordResetLinkSender> logger)
    {
        _logger = logger;
    }

    public Task SendResetLinkAsync(string email, string resetLink, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        _logger.LogInformation("Password reset link for {Email}: {ResetLink}", email, resetLink);

        return Task.CompletedTask;
    }
}