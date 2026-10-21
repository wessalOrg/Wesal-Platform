using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;
using Wesal.Application.Common.Interfaces;

namespace Wesal.Infrastructure.Email;

public sealed class EmailOptions
{
    public const string SectionName = "Email";

    public bool Enable { get; set; }

    public string? From { get; set; }

    public string? Host { get; set; }

    public int Port { get; set; } = 587;

    public string? Username { get; set; }

    public string? Password { get; set; }

    public bool UseSsl { get; set; } = true;
}

/// <summary>
/// MailKit SMTP-backed <see cref="IEmailService"/> (US-ADMIN-08, FR-SUB-02). When no SMTP
/// endpoint is configured (<c>Email:Enable</c> false or <c>Email:Host</c> empty) or the
/// send itself fails, the service reports failure — it never pretends an e-mail was
/// sent — so callers can apply their retry-with-escalation behaviour instead of
/// silently losing a warning.
/// </summary>
public sealed class EmailService : IEmailService
{
    private readonly EmailOptions _options;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IOptions<EmailOptions> options, ILogger<EmailService> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task<bool> TrySendAsync(
        string to,
        string subject,
        string body,
        CancellationToken cancellationToken = default)
    {
        if (!_options.Enable ||
            string.IsNullOrWhiteSpace(_options.Host) ||
            string.IsNullOrWhiteSpace(_options.From) ||
            string.IsNullOrWhiteSpace(_options.Username) ||
            string.IsNullOrWhiteSpace(_options.Password))
        {
            _logger.LogWarning(
                "E-mail send skipped for {To}: SMTP is not fully configured (Email:Enable={Enable}, Host/From/Username/Password set={Configured})",
                to,
                _options.Enable,
                !string.IsNullOrWhiteSpace(_options.Host) &&
                !string.IsNullOrWhiteSpace(_options.From) &&
                !string.IsNullOrWhiteSpace(_options.Username) &&
                !string.IsNullOrWhiteSpace(_options.Password));
            return false;
        }

        try
        {
            var message = new MimeMessage();
            message.From.Add(MailboxAddress.Parse(_options.From ?? string.Empty));
            message.To.Add(MailboxAddress.Parse(to));
            message.Subject = subject;
            message.Body = new TextPart("plain") { Text = body };

            using var client = new SmtpClient
            {
                Timeout = 30_000
            };

            var socketOptions = !_options.UseSsl
                ? SecureSocketOptions.None
                : _options.Port == 465
                    ? SecureSocketOptions.SslOnConnect
                    : SecureSocketOptions.StartTls;

            await client.ConnectAsync(_options.Host, _options.Port, socketOptions, cancellationToken);
            if (!string.IsNullOrWhiteSpace(_options.Username))
                await client.AuthenticateAsync(_options.Username, _options.Password ?? string.Empty, cancellationToken);
            await client.SendAsync(message, cancellationToken);
            await client.DisconnectAsync(true, cancellationToken);
            return true;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "E-mail send failed for {To}: {Subject}", to, subject);
            return false;
        }
    }
}
