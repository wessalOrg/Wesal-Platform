using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces.Persistence;

namespace Wesal.Infrastructure.Admin;

public sealed class PublishingRestrictionBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PublishingRestrictionBackgroundService> _logger;
    private readonly TimeProvider _clock;

    public PublishingRestrictionBackgroundService(IServiceScopeFactory scopeFactory,
        ILogger<PublishingRestrictionBackgroundService> logger, TimeProvider clock)
    {
        _scopeFactory = scopeFactory; _logger = logger; _clock = clock;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                await scope.ServiceProvider.GetRequiredService<IUserPublishingRestrictionRepository>()
                    .LiftExpiredAsync(_clock.GetUtcNow(), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception exception) { _logger.LogError(exception, "Publishing restriction expiry processing failed."); }

            try
            {
                if (!await timer.WaitForNextTickAsync(stoppingToken)) break;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}
