using System.Threading.RateLimiting;
using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Wesal.API;

/// <summary>
/// Wires an optional global HTTP limiter and a dedicated Mabrouk limiter.
/// Previously the named policy was registered but never attached to any
/// endpoint, so enabling RateLimiting changed nothing. Now the fixed-window
/// limiter runs as the <see cref="RateLimiterOptions.GlobalLimiter"/>, which
/// protects every request when enabled; health, root and SignalR hub
/// endpoints opt out explicitly so monitoring and realtime stay reachable.
/// The global policy remains opt-in. Mabrouk's cost-protection policy is
/// enabled by default and only applies to the assistant endpoint.
/// </summary>
public static class RateLimiting
{
    public static IServiceCollection AddWesalRateLimiting(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var options = new RateLimitingOptions();
        configuration.GetSection(RateLimitingOptions.SectionName).Bind(options);
        var assistant = new AssistantRateLimitingOptions();
        configuration.GetSection($"{RateLimitingOptions.SectionName}:Assistant").Bind(assistant);

        if (options.Enabled && options.PermitLimit <= 0)
        {
            throw new InvalidOperationException(
                "RateLimiting:PermitLimit must be greater than 0 when RateLimiting is enabled.");
        }

        if (options.Enabled && options.WindowSeconds <= 0)
        {
            throw new InvalidOperationException(
                "RateLimiting:WindowSeconds must be greater than 0 when RateLimiting is enabled.");
        }

        if (assistant.Enabled && (assistant.TokenLimit <= 0
            || assistant.TokensPerPeriod <= 0
            || assistant.ReplenishmentPeriodSeconds <= 0
            || assistant.ConcurrencyLimit <= 0))
        {
            throw new InvalidOperationException(
                "RateLimiting:Assistant limits must be positive when Mabrouk rate limiting is enabled.");
        }

        services.AddRateLimiter(limiterOptions =>
        {
            limiterOptions.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            if (options.Enabled)
            {
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
            }

            if (assistant.Enabled)
            {
                limiterOptions.AddPolicy(AssistantRateLimitingOptions.PolicyName, context =>
                {
                    var userKey = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                    var partitionKey = !string.IsNullOrWhiteSpace(userKey)
                        ? $"user:{userKey}"
                        : $"ip:{context.Connection.RemoteIpAddress?.ToString() ?? "unknown"}";

                    return RateLimitPartition.Get(partitionKey, key => RateLimiter.CreateChained(
                        new TokenBucketRateLimiter(new TokenBucketRateLimiterOptions
                        {
                            TokenLimit = assistant.TokenLimit,
                            TokensPerPeriod = assistant.TokensPerPeriod,
                            ReplenishmentPeriod = TimeSpan.FromSeconds(assistant.ReplenishmentPeriodSeconds),
                            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                            QueueLimit = 0,
                            AutoReplenishment = true
                        }),
                        new ConcurrencyLimiter(new ConcurrencyLimiterOptions
                        {
                            PermitLimit = assistant.ConcurrencyLimit,
                            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                            QueueLimit = 0
                        })));
                });
            }
        });

        return services;
    }
}
