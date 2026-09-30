using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Infrastructure.Admin;
using Wesal.Infrastructure.Warnings;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Subscription scheduler reliability (production hardening, Phase 11): both jobs
/// must execute on service start instead of waiting one full interval, so a
/// restart can never delay or skip a due lock or warning. The underlying
/// operations are idempotent, so the startup run is safe to repeat.
/// </summary>
public sealed class SubscriptionBackgroundServicesShould
{
    private sealed class CountingLockService : ISubscriptionExpiryLockService
    {
        public int Calls;
        public Task<int> LockExpiredCyclesAsync(CancellationToken cancellationToken = default)
        {
            Calls++;
            return Task.FromResult(0);
        }
    }

    private sealed class CountingWarningService : ISubscriptionExpiryWarningService
    {
        public int Calls;
        public Task<int> WarnCyclesEndingSoonAsync(CancellationToken cancellationToken = default)
        {
            Calls++;
            return Task.FromResult(0);
        }
    }

    [Fact]
    public async Task LockJob_RunsOnStartup_BeforeFirstInterval()
    {
        var counter = new CountingLockService();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<ISubscriptionExpiryLockService>(counter);
        services.Configure<SubscriptionExpiryLockOptions>(o => o.IntervalMinutes = 60 * 24 * 30);
        using var provider = services.BuildServiceProvider();

        var job = new SubscriptionExpiryLockBackgroundService(
            provider.GetRequiredService<IServiceScopeFactory>(),
            provider.GetRequiredService<IOptions<SubscriptionExpiryLockOptions>>(),
            NullLogger<SubscriptionExpiryLockBackgroundService>.Instance);

        using var cts = new CancellationTokenSource();
        await job.StartAsync(cts.Token);
        await Task.Delay(500, CancellationToken.None);
        await job.StopAsync(CancellationToken.None);

        Assert.True(counter.Calls >= 1);
    }

    [Fact]
    public async Task WarningJob_RunsOnStartup_BeforeFirstInterval()
    {
        var counter = new CountingWarningService();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<ISubscriptionExpiryWarningService>(counter);
        services.Configure<SubscriptionExpiryWarningOptions>(o => o.IntervalMinutes = 60 * 24 * 30);
        using var provider = services.BuildServiceProvider();

        var job = new SubscriptionExpiryWarningBackgroundService(
            provider.GetRequiredService<IServiceScopeFactory>(),
            provider.GetRequiredService<IOptions<SubscriptionExpiryWarningOptions>>(),
            NullLogger<SubscriptionExpiryWarningBackgroundService>.Instance);

        using var cts = new CancellationTokenSource();
        await job.StartAsync(cts.Token);
        await Task.Delay(500, CancellationToken.None);
        await job.StopAsync(CancellationToken.None);

        Assert.True(counter.Calls >= 1);
    }
}
