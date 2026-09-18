using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;

namespace Wesal.Infrastructure.Admin;

public class SubscriptionExpiryLockOptions
{
    public const string SectionName = "SubscriptionExpiryLock";
    public int IntervalMinutes { get; set; } = 1440;
}

/// <summary>
/// Daily background job that auto-locks halls whose paid subscription cycle ended
/// without a confirmed renewal (US-ADMIN-09, FR-SUB-03). Runs on a configurable
/// interval (default 24h). Failures never crash the host: the job logs and retries on
/// the next tick, and the per-hall lock is atomic (see
/// <see cref="SubscriptionExpiryLockService"/>).
/// </summary>
public class SubscriptionExpiryLockBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SubscriptionExpiryLockBackgroundService> _logger;
    private readonly SubscriptionExpiryLockOptions _options;

    public SubscriptionExpiryLockBackgroundService(
        IServiceScopeFactory scopeFactory,
        IOptions<SubscriptionExpiryLockOptions> options,
        ILogger<SubscriptionExpiryLockBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Automatic subscription-lock background service started with interval {Interval} minutes", _options.IntervalMinutes);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromMinutes(_options.IntervalMinutes), stoppingToken);
                using var scope = _scopeFactory.CreateScope();
                var lockService = scope.ServiceProvider.GetRequiredService<ISubscriptionExpiryLockService>();
                var locked = await lockService.LockExpiredCyclesAsync(stoppingToken);
                if (locked > 0)
                {
                    _logger.LogInformation("Background job automatically locked {Count} halls with expired subscription cycles", locked);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during automatic subscription-lock job");
            }
        }
    }
}