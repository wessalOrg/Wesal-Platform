using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Wesal.Infrastructure.Email;

namespace Wesal.Tests.Infrastructure;

public class EmailServiceShould
{
    [Fact]
    public async Task TrySendAsync_NoSmtpConfigured_ReturnsFalse()
    {
        var service = new EmailService(
            Options.Create(new EmailOptions { Enable = false }),
            NullLogger<EmailService>.Instance);

        var sent = await service.TrySendAsync("owner@example.com", "subject", "body");

        Assert.False(sent);
    }

    [Fact]
    public async Task TrySendAsync_EnabledButNoHost_ReturnsFalse()
    {
        var service = new EmailService(
            Options.Create(new EmailOptions { Enable = true, Host = null }),
            NullLogger<EmailService>.Instance);

        var sent = await service.TrySendAsync("owner@example.com", "subject", "body");

        Assert.False(sent);
    }
}