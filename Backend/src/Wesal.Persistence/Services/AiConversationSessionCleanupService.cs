using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces.Persistence;

namespace Wesal.Persistence.Services;

internal sealed class AiConversationSessionCleanupService : BackgroundService
{
    private static readonly TimeSpan SweepInterval = TimeSpan.FromMinutes(5);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AiConversationSessionCleanupService> _logger;

    public AiConversationSessionCleanupService(
        IServiceScopeFactory scopeFactory,
        ILogger<AiConversationSessionCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(SweepInterval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var store = scope.ServiceProvider.GetRequiredService<IAiConversationSessionStore>();
                await store.DeleteExpiredAsync(DateTimeOffset.UtcNow, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                _logger.LogWarning("Expired assistant-session cleanup failed ({ExceptionType})", exception.GetType().Name);
            }
        }
    }
}
