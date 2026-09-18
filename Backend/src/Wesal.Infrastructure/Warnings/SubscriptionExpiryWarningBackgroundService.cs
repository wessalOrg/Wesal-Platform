using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;

namespace Wesal.Infrastructure.Warnings;

public class SubscriptionExpiryWarningOptions
{
    public const string SectionName = "SubscriptionExpiryWarning";

    public int IntervalMinutes { get; set; } = 1440;

    /// <summary>
    /// Consecutive failed e-mail attempts after which the warning is escalated (logged
    /// at error level with hall details). Retries continue until the send succeeds or
    /// the cycle ends, so a warning is never silently lost.
    /// </summary>
    public int EscalationThreshold { get; set; } = 3;
}

/// <summary>
/// Daily background job that warns owners whose paid subscription cycle ends in exactly
/// 3 days (US-ADMIN-08, FR-SUB-02). Runs on a configurable interval (default 24h) and
/// is idempotent per cycle. Failures never crash the host: the job logs and retries on
/// the next tick, and the warning service drives retry-with-escalation for e-mail.
/// </summary>
public class SubscriptionExpiryWarningBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SubscriptionExpiryWarningBackgroundService> _logger;
    private readonly SubscriptionExpiryWarningOptions _options;

    public SubscriptionExpiryWarningBackgroundService(
        IServiceScopeFactory scopeFactory,
        IOptions<SubscriptionExpiryWarningOptions> options,
        ILogger<SubscriptionExpiryWarningBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Subscription expiry-warning background service started with interval {Interval} minutes",
            _options.IntervalMinutes);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromMinutes(_options.IntervalMinutes), stoppingToken);

                using var scope = _scopeFactory.CreateScope();
                var warningService = scope.ServiceProvider.GetRequiredService<ISubscriptionExpiryWarningService>();
                var delivered = await warningService.WarnCyclesEndingSoonAsync(stoppingToken);

                if (delivered > 0)
                {
                    _logger.LogInformation("Background job delivered {Count} subscription expiry warnings", delivered);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during subscription expiry-warning job");
            }
        }
    }
}