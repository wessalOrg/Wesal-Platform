using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Wesal.API;

/// <summary>
/// Wires the optional global HTTP rate limiter (production hardening).
/// Previously the named policy was registered but never attached to any
/// endpoint, so enabling RateLimiting changed nothing. Now the fixed-window
/// limiter runs as the <see cref="RateLimiterOptions.GlobalLimiter"/>, which
/// protects every request when enabled; health, root and SignalR hub
/// endpoints opt out explicitly so monitoring and realtime stay reachable.
/// Disabled by default: existing deployments behave exactly as before until
/// RateLimiting:Enabled is set with positive PermitLimit/WindowSeconds.
/// </summary>
public static class RateLimiting
{
    public static IServiceCollection AddWesalRateLimiting(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var options = new RateLimitingOptions();
        configuration.GetSection(RateLimitingOptions.SectionName).Bind(options);

        if (!options.Enabled)
        {
            return services;
        }

        if (options.PermitLimit <= 0)
        {
            throw new InvalidOperationException(
                "RateLimiting:PermitLimit must be greater than 0 when RateLimiting is enabled.");
        }

        if (options.WindowSeconds <= 0)
        {
            throw new InvalidOperationException(
                "RateLimiting:WindowSeconds must be greater than 0 when RateLimiting is enabled.");
        }

        services.AddRateLimiter(limiterOptions =>
        {
            limiterOptions.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            limiterOptions.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = options.PermitLimit,
                        Window = TimeSpan.FromSeconds(options.WindowSeconds),
                        QueueLimit = 0,
                        AutoReplenishment = true
                    }));
        });

        return services;
    }
}
