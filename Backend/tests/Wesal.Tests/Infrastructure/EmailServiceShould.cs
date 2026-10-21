using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using System.Net;
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

        var sent = await service.TrySendAsync("user@example.com", "Reset", "Reset body");

        Assert.True(sent);
        Assert.Equal("https://api.brevo.com/v3/smtp/email", capturedUri);
        Assert.Equal("test-key", capturedApiKey);
        Assert.Contains("\"email\":\"wesalplatform.gaza@gmail.com\"", capturedPayload);
        Assert.Contains("\"email\":\"user@example.com\"", capturedPayload);
        Assert.Contains("\"textContent\":\"Reset body\"", capturedPayload);
    }

    [Fact]
    public async Task TrySendAsync_BrevoApiRejected_ReturnsFalse()
    {
        var service = new EmailService(
            Options.Create(new EmailOptions
            {
                Enable = true,
                Provider = EmailOptions.BrevoApiProvider,
                From = "Wesal Platform <wesalplatform.gaza@gmail.com>",
                ApiKey = "test-key"
            }),
            NullLogger<EmailService>.Instance,
            new TestHttpClientFactory(new StubHandler(HttpStatusCode.Unauthorized)));

        var sent = await service.TrySendAsync("user@example.com", "Reset", "Reset body");

        Assert.False(sent);
    }

    private sealed class TestHttpClientFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
    }

    private sealed class StubHandler(
        HttpStatusCode statusCode,
        Action<HttpRequestMessage>? onRequest = null) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            onRequest?.Invoke(request);
            return Task.FromResult(new HttpResponseMessage(statusCode));
        }
    }
}
