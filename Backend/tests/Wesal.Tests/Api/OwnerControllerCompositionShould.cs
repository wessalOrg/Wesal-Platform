using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Wesal.API.Controllers;
using Wesal.Application;
using Wesal.Infrastructure;
using Wesal.Persistence;

namespace Wesal.Tests.Api;

/// <summary>
/// Production DI composition guard for <see cref="OwnerController"/>.
///
/// Regression for the production hall-create 500: the controller requires
/// IOwnerIdentityService, but the production composition root did not register
/// it, so ASP.NET Core threw
/// "Unable to resolve service for type '...IOwnerIdentityService...' while
/// attempting to activate '...OwnerController'" on EVERY owner endpoint before
/// any action code ran. The existing pipeline tests missed it because they
/// build a trimmed container with a StubOwnerIdentityService.
///
/// This test wires the REAL production registrations (plus SignalR, exactly as
/// Program.cs does) and proves the controller's full dependency graph resolves.
/// </summary>
public sealed class OwnerControllerCompositionShould
{
    private static ServiceProvider BuildProductionServices()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] =
                    "Host=localhost;Port=5432;Database=wesal;Username=postgres;Password=postgres"
            })
            .Build();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddApplication();
        services.AddInfrastructure(configuration);
        services.AddPersistence(configuration);
        // Mirrors Program.cs: the owner graph's notification notifiers run on
        // SignalR hub contexts, which Program.cs (not AddInfrastructure) registers.
        services.AddSignalR();
        return services.BuildServiceProvider();
    }

    [Fact]
    public void OwnerController_ResolvesFromProductionRegistrations()
    {
        using var provider = BuildProductionServices();
        using var scope = provider.CreateScope();

        var controller = ActivatorUtilities.CreateInstance<OwnerController>(scope.ServiceProvider);

        Assert.NotNull(controller);
    }
}
