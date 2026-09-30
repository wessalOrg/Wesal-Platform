using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Wesal.API;

namespace Wesal.Tests.Api;

/// <summary>
/// Rate-limiting wiring guard (production hardening, Phase 6): enabling
/// RateLimiting must actually throttle requests (429) instead of registering
/// an unattached policy, while exempt endpoints stay reachable.
/// </summary>
public sealed class RateLimitingShould
{
    private static (WebApplication App, HttpClient Client) BuildApp(
        bool enabled, int permitLimit)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["RateLimiting:Enabled"] = enabled.ToString(),
            ["RateLimiting:PermitLimit"] = permitLimit.ToString(),
            ["RateLimiting:WindowSeconds"] = "60"
        });
        builder.Services.AddWesalRateLimiting(builder.Configuration);
        var app = builder.Build();
        // Mirrors Program.cs: the middleware only runs when limiting is enabled.
        if (enabled)
        {
            app.UseRateLimiter();
        }
        app.MapGet("/limited", () => Results.Ok("ok"));
        app.MapGet("/exempt", () => Results.Ok("ok")).DisableRateLimiting();
        app.StartAsync().GetAwaiter().GetResult();
        return (app, app.GetTestClient());
    }

    [Fact]
    public async Task EnabledLimiter_Returns429OverLimit()
    {
        var (app, client) = BuildApp(enabled: true, permitLimit: 2);
        await using var _ = app;

        Assert.Equal(200, (int)(await client.GetAsync("/limited")).StatusCode);
        Assert.Equal(200, (int)(await client.GetAsync("/limited")).StatusCode);
        Assert.Equal(429, (int)(await client.GetAsync("/limited")).StatusCode);
    }

    [Fact]
    public async Task ExemptEndpoint_IsNeverLimited()
    {
        var (app, client) = BuildApp(enabled: true, permitLimit: 1);
        await using var _ = app;

        for (var i = 0; i < 3; i++)
        {
            Assert.Equal(200, (int)(await client.GetAsync("/exempt")).StatusCode);
        }
    }

    [Fact]
    public async Task DisabledLimiter_AllowsEverything()
    {
        var (app, client) = BuildApp(enabled: false, permitLimit: 1);
        await using var _ = app;

        for (var i = 0; i < 3; i++)
        {
            Assert.Equal(200, (int)(await client.GetAsync("/limited")).StatusCode);
        }
    }

    [Fact]
    public void EnabledWithNonPositivePermitLimit_ThrowsAtStartup()
    {
        var services = new ServiceCollection();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["RateLimiting:Enabled"] = "true",
                ["RateLimiting:PermitLimit"] = "0",
                ["RateLimiting:WindowSeconds"] = "60"
            })
            .Build();

        Assert.Throws<InvalidOperationException>(() => services.AddWesalRateLimiting(configuration));
    }
}
