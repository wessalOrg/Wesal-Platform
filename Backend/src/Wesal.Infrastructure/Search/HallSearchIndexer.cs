using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.Search;

public class HallSearchIndexer : IHallSearchIndexer
{
    private readonly ConcurrentDictionary<Guid, HallSearchIndexDto> _index = new();
    private readonly ConcurrentDictionary<Guid, HallSearchIndexDto> _pending = new();
    private readonly ILogger<HallSearchIndexer> _logger;

    public HallSearchIndexer(ILogger<HallSearchIndexer> logger)
    {
        _logger = logger;
    }

    public Task IndexHallAsync(HallSearchIndexDto hall, CancellationToken cancellationToken = default)
    {
        // Simulate potential transient failure (for testing, we can inject failure via test double)
        // In production, this would call external search or update DB projection
        // For now, we make it idempotent via upsert
        _index.AddOrUpdate(hall.HallId, hall, (_, _) => hall);
        _pending.TryRemove(hall.HallId, out _);
        _logger.LogInformation("Hall {HallId} indexed for search", hall.HallId);
        return Task.CompletedTask;
    }

    public Task<bool> IsIndexedAsync(Guid hallId, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(_index.ContainsKey(hallId));
    }

    public async Task RetryPendingAsync(CancellationToken cancellationToken = default)
    {
        foreach (var kvp in _pending.ToArray())
        {
            try
            {
                await IndexHallAsync(kvp.Value, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Retry indexing failed for hall {HallId}", kvp.Key);
            }
        }
    }

    // For testing: simulate failure
    public void SimulateFailure(HallSearchIndexDto hall)
    {
        _pending[hall.HallId] = hall;
    }
}
