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