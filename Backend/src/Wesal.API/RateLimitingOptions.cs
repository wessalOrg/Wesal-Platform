namespace Wesal.API;

/// <summary>
/// Strongly typed configuration for the optional global HTTP rate limiter.
/// Bound from the "RateLimiting" configuration section. Disabled by default so
/// existing deployments behave exactly as before until explicitly enabled.
/// </summary>
public sealed class RateLimitingOptions
{
    public const string SectionName = "RateLimiting";
    public const string GlobalPolicyName = "global";

    public bool Enabled { get; set; }

    public int PermitLimit { get; set; } = 100;

    public int WindowSeconds { get; set; } = 60;
}

/// <summary>Cost-protection policy for the anonymous-capable Mabrouk endpoint.</summary>
public sealed class AssistantRateLimitingOptions
{
    public const string PolicyName = "assistant";
    public bool Enabled { get; set; } = true;
    public int TokenLimit { get; set; } = 6;
    // The bucket has a capacity of six, so replenishing twelve tokens at once
    // every minute silently caps each refill at six. Refill six every 30 seconds
    // to retain the six-request burst and deliver twelve requests per minute.
    public int TokensPerPeriod { get; set; } = 6;
    public int ReplenishmentPeriodSeconds { get; set; } = 30;
    public int ConcurrencyLimit { get; set; } = 2;
}
