using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Middleware;

namespace Wesal.Tests.Api;

/// <summary>
/// Error-observability guard (production hardening, Phase 19): every error
/// response carries a safe traceId that matches the server log line, while
/// stack traces and internal messages never leak to clients.
/// </summary>
public sealed class ErrorTraceIdShould
{
    private static HttpClient BuildClient()
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        builder.Services.AddLogging();
        builder.Services.AddControllers();
        var app = builder.Build();
        app.UseMiddleware<GlobalExceptionHandlingMiddleware>();
        app.MapGet("/boom", Boom);
        app.MapGet("/bad", Bad);
        app.StartAsync().GetAwaiter().GetResult();
        return app.GetTestClient();
    }

    private static IResult Boom() => throw new InvalidOperationException("super-secret-stack-details");

    private static IResult Bad() => throw new ValidationException(
        new Dictionary<string, string[]> { ["Name"] = ["required"] });

    [Fact]
    public async Task UnexpectedError_Returns500WithTraceIdAndNoLeak()
    {
        using var client = BuildClient();

        var response = await client.GetAsync("/boom");
        Assert.Equal(500, (int)response.StatusCode);

        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = body.RootElement;
        Assert.True(root.TryGetProperty("traceId", out var traceId));
        Assert.False(string.IsNullOrWhiteSpace(traceId.GetString()));

        var raw = root.GetRawText();
        Assert.DoesNotContain("super-secret-stack-details", raw, StringComparison.Ordinal);
        Assert.DoesNotContain("at ", raw, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ValidationError_Returns400WithTraceId()
    {
        using var client = BuildClient();

        var response = await client.GetAsync("/bad");
        Assert.Equal(400, (int)response.StatusCode);

        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(body.RootElement.TryGetProperty("traceId", out var traceId));
        Assert.False(string.IsNullOrWhiteSpace(traceId.GetString()));
    }
}
