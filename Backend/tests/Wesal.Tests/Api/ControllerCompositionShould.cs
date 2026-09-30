using System.Reflection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application;
using Wesal.Infrastructure;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Notifications;
using Wesal.Infrastructure.OwnerDashboard;
using Wesal.Persistence;

namespace Wesal.Tests.Api;

/// <summary>
/// Full composition-root guard (production hardening): every API controller and
/// SignalR hub must resolve from the REAL production registrations. The
/// OwnerController/IOwnerIdentityService outage proved trimmed test containers
/// with stubs hide missing production dependencies; this test wires
/// AddApplication/AddInfrastructure/AddPersistence plus SignalR exactly like
/// Program.cs and activates each component.
/// </summary>
public sealed class ControllerCompositionShould
{
    public static TheoryData<Type> ControllersAndHubs
    {
        get
        {
            var data = new TheoryData<Type>();
            var apiAssembly = typeof(Wesal.API.Controllers.OwnerController).Assembly;
            foreach (var type in apiAssembly.GetTypes())
            {
                if (type.IsAbstract || !type.IsClass)
                {
                    continue;
                }

                if (type.IsSubclassOf(typeof(ControllerBase)))
                {
                    data.Add(type);
                }
            }

            data.Add(typeof(ConversationHub));
            data.Add(typeof(OwnerDashboardHub));
            data.Add(typeof(NotificationsHub));
            return data;
        }
    }

    [Theory]
    [MemberData(nameof(ControllersAndHubs))]
    public void Component_ResolvesFromProductionRegistrations(Type componentType)
    {
        using var provider = BuildProductionServices();
        using var scope = provider.CreateScope();

        var instance = ActivatorUtilities.CreateInstance(scope.ServiceProvider, componentType);

        Assert.NotNull(instance);
        Assert.IsType(componentType, instance);
    }

    private static ServiceProvider BuildProductionServices()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] =
                    "Host=localhost;Port=5432;Database=wesal;Username=postgres;Password=postgres",
                // Production refuses to boot without Jwt settings
                // (ValidateNonDevelopmentConfiguration + ValidateOnStart).
                ["Jwt:Issuer"] = "WesalAPI",
                ["Jwt:Audience"] = "WesalClients",
                ["Jwt:SecretKey"] = "test-secret-key-that-is-long-enough-32",
                ["Jwt:ExpirationMinutes"] = "60",
                ["Jwt:ClockSkewMinutes"] = "5"
            })
            .Build();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddApplication();
        services.AddInfrastructure(configuration);
        services.AddPersistence(configuration);
        // Mirrors Program.cs.
        services.AddSignalR();
        return services.BuildServiceProvider();
    }
}
