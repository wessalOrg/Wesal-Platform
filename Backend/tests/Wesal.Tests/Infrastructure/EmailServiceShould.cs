using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using System.Net;
using System.Text.Json;
using Wesal.Infrastructure.Email;

namespace Wesal.Tests.Infrastructure;

public class EmailServiceShould
{
    [Fact]
    public async Task TrySendAsync_NoSmtpConfigured_ReturnsFalse()
    {
        var service = new EmailService(
            Options.Create(new EmailOptions { Enable = false }),
            NullLogger<EmailService>.Instance,
            new TestHttpClientFactory(new StubHandler(HttpStatusCode.OK)));

        var sent = await service.TrySendAsync("owner@example.com", "subject", "body");

        Assert.False(sent);
    }

    [Fact]
    public async Task TrySendAsync_EnabledButNoHost_ReturnsFalse()
    {
        var service = new EmailService(
            Options.Create(new EmailOptions { Enable = true, Host = null }),
            NullLogger<EmailService>.Instance,
            new TestHttpClientFactory(new StubHandler(HttpStatusCode.OK)));

        var sent = await service.TrySendAsync("owner@example.com", "subject", "body");

        Assert.False(sent);
    }

    [Fact]
    public async Task TrySendAsync_BrevoApiConfigured_PostsMessageAndReturnsTrue()
    {
        string? capturedUri = null;
        string? capturedApiKey = null;
        string? capturedPayload = null;
        var service = new EmailService(
            Options.Create(new EmailOptions
            {
                Enable = true,
                Provider = EmailOptions.BrevoApiProvider,
                From = "Wesal Platform <wesalplatform.gaza@gmail.com>",
                ApiKey = "test-key"
            }),
            NullLogger<EmailService>.Instance,
            new TestHttpClientFactory(new StubHandler(HttpStatusCode.Created, request =>
            {
                capturedUri = request.RequestUri!.ToString();
                capturedApiKey = request.Headers.GetValues("api-key").Single();
                capturedPayload = request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();
            })));

        var sent = await service.TrySendAsync(
            "user@example.com",
            "Reset",
            "Reset body",
            "Mohammed Shamaa",
            "<html><body><a href=\"https://wesal.test/reset-password\">Reset</a></body></html>");

        Assert.True(sent);
        Assert.Equal("https://api.brevo.com/v3/smtp/email", capturedUri);
        Assert.Equal("test-key", capturedApiKey);
        using var payload = JsonDocument.Parse(capturedPayload!);
        Assert.Equal("wesalplatform.gaza@gmail.com", payload.RootElement.GetProperty("sender").GetProperty("email").GetString());
        var recipient = payload.RootElement.GetProperty("to")[0];
        Assert.Equal("user@example.com", recipient.GetProperty("email").GetString());
        Assert.Equal("Mohammed Shamaa", recipient.GetProperty("name").GetString());
        Assert.Contains("href=", payload.RootElement.GetProperty("htmlContent").GetString());
        Assert.False(payload.RootElement.TryGetProperty("textContent", out _));
    }

    [Fact]
    public async Task TrySendAsync_BrevoApiRejected_ReturnsFalseAndLogsProviderError()
    {
        var logger = new RecordingLogger<EmailService>();
        var service = new EmailService(
            Options.Create(new EmailOptions
            {
                Enable = true,
                Provider = EmailOptions.BrevoApiProvider,
                From = "Wesal Platform <wesalplatform.gaza@gmail.com>",
                ApiKey = "test-key"
            }),
            logger,
            new TestHttpClientFactory(new StubHandler(
                HttpStatusCode.BadRequest,
                responseContent: "{\"code\":\"invalid_parameter\",\"message\":\"Sender email is not verified\"}")));

        var sent = await service.TrySendAsync("user@example.com", "Reset", "Reset body");

        Assert.False(sent);
        Assert.Contains(logger.Messages, message =>
            message.Contains("invalid_parameter", StringComparison.Ordinal) &&
            message.Contains("Sender email is not verified", StringComparison.Ordinal));
    }

    private sealed class TestHttpClientFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
    }

    private sealed class StubHandler(
        HttpStatusCode statusCode,
        Action<HttpRequestMessage>? onRequest = null,
        string? responseContent = null) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            onRequest?.Invoke(request);
            return Task.FromResult(new HttpResponseMessage(statusCode)
            {
                Content = new StringContent(responseContent ?? string.Empty)
            });
        }
    }

    private sealed class RecordingLogger<T> : ILogger<T>
    {
        public List<string> Messages { get; } = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            Messages.Add(formatter(state, exception));
        }
    }
}
