using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;
using System.Net.Http.Json;
using System.Text.Json;
using Wesal.Application.Common.Interfaces;

namespace Wesal.Infrastructure.Email;

public sealed class EmailOptions
{
    public const string SectionName = "Email";

    public const string BrevoApiProvider = "BrevoApi";

    public string Provider { get; set; } = "Smtp";

    public bool Enable { get; set; }

    public string? From { get; set; }

    public string? Host { get; set; }

    public int Port { get; set; } = 587;

    public string? Username { get; set; }

    public string? Password { get; set; }

    public string? ApiKey { get; set; }

    public bool UseSsl { get; set; } = true;
}

/// <summary>
/// Sends e-mail through MailKit SMTP or the Brevo HTTPS API.
/// </summary>
public sealed class EmailService : IEmailService
{
    private readonly EmailOptions _options;
    private readonly ILogger<EmailService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;

    public EmailService(
        IOptions<EmailOptions> options,
        ILogger<EmailService> logger,
        IHttpClientFactory httpClientFactory)
    {
        _options = options.Value;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
    }

    public async Task<bool> TrySendAsync(
        string to,
        string subject,
        string body,
        CancellationToken cancellationToken = default)
    {
        if (string.Equals(_options.Provider, EmailOptions.BrevoApiProvider, StringComparison.OrdinalIgnoreCase))
            return await TrySendWithBrevoApiAsync(to, subject, body, cancellationToken);

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

    private async Task<bool> TrySendWithBrevoApiAsync(
        string to,
        string subject,
        string body,
        CancellationToken cancellationToken)
    {
        if (!_options.Enable ||
            string.IsNullOrWhiteSpace(_options.From) ||
            string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            _logger.LogWarning(
                "E-mail send skipped for {To}: Brevo API is not fully configured (Email:Enable={Enable}, From/API key set={Configured})",
                to,
                _options.Enable,
                !string.IsNullOrWhiteSpace(_options.From) && !string.IsNullOrWhiteSpace(_options.ApiKey));
            return false;
        }

        try
        {
            var sender = MailboxAddress.Parse(_options.From);
            var recipient = MailboxAddress.Parse(to);
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email");
            request.Headers.TryAddWithoutValidation("api-key", _options.ApiKey);
            request.Headers.TryAddWithoutValidation("accept", "application/json");
            request.Content = JsonContent.Create(new
            {
                sender = new { name = sender.Name, email = sender.Address },
                to = new[] { new { name = recipient.Name, email = recipient.Address } },
                subject,
                textContent = body
            });

            using var response = await _httpClientFactory.CreateClient().SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
                var (errorCode, errorMessage) = ReadBrevoError(responseBody);
                _logger.LogWarning(
                    "Brevo API rejected e-mail for {To} with HTTP status {StatusCode}. Error code: {BrevoErrorCode}; message: {BrevoErrorMessage}",
                    to,
                    (int)response.StatusCode,
                    errorCode,
                    errorMessage);
                return false;
            }

            return true;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Brevo API e-mail send failed for {To}: {Subject}", to, subject);
            return false;
        }
    }

    private static (string Code, string Message) ReadBrevoError(string responseBody)
    {
        try
        {
            using var document = JsonDocument.Parse(responseBody);
            var root = document.RootElement;
            var code = root.TryGetProperty("code", out var codeElement) && codeElement.ValueKind == JsonValueKind.String
                ? codeElement.GetString()
                : null;
            var message = root.TryGetProperty("message", out var messageElement) && messageElement.ValueKind == JsonValueKind.String
                ? messageElement.GetString()
                : null;

            return (LimitErrorDetail(code), LimitErrorDetail(message));
        }
        catch (JsonException)
        {
            return ("unavailable", "Brevo returned a non-JSON error response");
        }
    }

    private static string LimitErrorDetail(string? value) =>
        string.IsNullOrWhiteSpace(value) ? "unavailable" : value[..Math.Min(value.Length, 300)];
}
