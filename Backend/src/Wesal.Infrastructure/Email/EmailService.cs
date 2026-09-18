using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
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
/// SMTP-backed <see cref="IEmailService"/> (US-ADMIN-08, FR-SUB-02). When no SMTP
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
        if (!_options.Enable || string.IsNullOrWhiteSpace(_options.Host))
        {
            _logger.LogWarning(
                "E-mail send skipped for {To}: no SMTP endpoint configured (Email:Enable={Enable}, Email:Host set={HostSet})",
                to,
                _options.Enable,
                !string.IsNullOrWhiteSpace(_options.Host));
            return false;
        }

        try
        {
#pragma warning disable SYSLIB0014
            using var client = new SmtpClient
            {
                Host = _options.Host,
                Port = _options.Port,
                EnableSsl = _options.UseSsl,
                Timeout = 30_000,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                UseDefaultCredentials = string.IsNullOrWhiteSpace(_options.Username),
                Credentials = string.IsNullOrWhiteSpace(_options.Username)
                    ? null
                    : new NetworkCredential(_options.Username, _options.Password)
            };

            var message = new MailMessage
            {
                From = new MailAddress(_options.From ?? string.Empty),
                Subject = subject,
                Body = body,
                IsBodyHtml = false
            };

            message.To.Add(to);

            await client.SendMailAsync(message, cancellationToken);
            return true;
#pragma warning restore SYSLIB0014
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