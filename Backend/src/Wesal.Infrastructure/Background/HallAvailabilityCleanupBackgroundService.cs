using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;

namespace Wesal.Infrastructure.Background;

public class HallAvailabilityCleanupOptions
{
    public const string SectionName = "HallAvailabilityCleanup";
    public int IntervalMinutes { get; set; } = 5;
}

public class HallAvailabilityCleanupBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<HallAvailabilityCleanupBackgroundService> _logger;
    private readonly HallAvailabilityCleanupOptions _options;

    public HallAvailabilityCleanupBackgroundService(
        IServiceScopeFactory scopeFactory,
        IOptions<HallAvailabilityCleanupOptions> options,
        ILogger<HallAvailabilityCleanupBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Hall availability cleanup background service started with interval {Interval} minutes", _options.IntervalMinutes);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromMinutes(_options.IntervalMinutes), stoppingToken);
                using var scope = _scopeFactory.CreateScope();
                var cleanupService = scope.ServiceProvider.GetRequiredService<IHallAvailabilityCleanupService>();
                var cleaned = await cleanupService.CleanupExpiredAsync(stoppingToken);
                if (cleaned > 0)
                    _logger.LogInformation("Background cleanup cleaned {Count} expired availabilities", cleaned);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during hall availability cleanup");
            }
        }
    }
}
