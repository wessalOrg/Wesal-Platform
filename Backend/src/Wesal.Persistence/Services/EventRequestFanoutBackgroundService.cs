using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;

namespace Wesal.Persistence.Services;

public sealed class EventRequestFanoutBackgroundService(IServiceScopeFactory scopes, ILogger<EventRequestFanoutBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<IEventRequestService>().ProcessPendingAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Event request notification queue iteration failed"); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
