using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Application.Common.Interfaces;
using Wesal.Domain.Constants;
using Wesal.Infrastructure;
using Wesal.Infrastructure.Conversations;
using Wesal.Infrastructure.Notifications;
using Wesal.Persistence;
using Xunit;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// WESAL-TASK-13 / Edit 13: guards the production DI registrations for the notification layer.
/// </summary>
/// <remarks>
/// <para>
/// This exists because the failure mode of a missing notification registration is invisible
/// to a compile and to almost every test: the services still construct in isolation, and the
/// only symptom in production is a 500 on whichever action first resolves them — for this
/// edit, <c>POST /api/v1/auth/login</c>, the single endpoint every user hits.
/// </para>
/// <para>
/// It asserts against the real <see cref="DependencyInjection.AddInfrastructure"/> wiring
/// rather than a hand-built container, so a registration that is added to production but
/// forgotten in test setup, or vice versa, is caught here.
/// </para>
/// </remarks>
public sealed class NotificationRegistrationShould
{
    private static IServiceCollection BuildProductionServices()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JwtSettings:Issuer"] = "WesalTests",
                ["JwtSettings:Audience"] = "WesalTests",
                ["JwtSettings:SecretKey"] = "Wesal-Registration-Guard-Secret-Key-For-Tests-Only",
                ["JwtSettings:ExpirationMinutes"] = "30",
                ["ConnectionStrings:DefaultConnection"] = "Server=(localdb)\\mssqllocaldb;Database=WesalTests;Trusted_Connection=True;",
                ["GoogleAiSettings:ApiKey"] = "test-key",
                ["GoogleAiSettings:BaseUrl"] = "https://example.invalid"
            })
            .Build();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddPersistence(configuration);
        services.AddInfrastructure(configuration);

        return services;
    }

    [Fact]
    public void NotificationServices_AreRegisteredInTheProductionContainer()
    {
        var services = BuildProductionServices();

        Assert.Contains(services, d => d.ServiceType == typeof(INotificationService)
                                       && d.ImplementationType == typeof(NotificationService));

        Assert.Contains(services, d => d.ServiceType == typeof(INotificationNotifier)
                                       && d.ImplementationType == typeof(NotificationNotifier));

        Assert.Contains(services, d => d.ServiceType == typeof(INotificationDispatcher)
                                       && d.ImplementationType == typeof(NotificationDispatcher));
    }

    [Fact]
    public void NotificationServices_AreScoped_SoEachRequestGetsItsOwn()
    {
        var services = BuildProductionServices();

        foreach (var serviceType in new[]
                 {
                     typeof(INotificationService),
                     typeof(INotificationNotifier),
                     typeof(INotificationDispatcher)
                 })
        {
            var descriptor = Assert.Single(services, d => d.ServiceType == serviceType);
            Assert.Equal(ServiceLifetime.Scoped, descriptor.Lifetime);
        }
    }

    [Fact]
    public void NotificationServices_AreNotRegisteredTwice()
    {
        // A duplicate registration silently shadows the first, and which one wins depends on
        // ordering. Guarding the count keeps the wiring unambiguous.
        var services = BuildProductionServices();

        foreach (var serviceType in new[]
                 {
                     typeof(INotificationService),
                     typeof(INotificationNotifier),
                     typeof(INotificationDispatcher)
                 })
        {
            Assert.Single(services, d => d.ServiceType == serviceType);
        }
    }

    [Fact]
    public void NotificationHub_PublishesAStableClientEventName()
    {
        // The SignalR event name is part of the published contract with the frontend, so a
        // rename is a deliberate edit rather than an accident.
        Assert.Equal("NotificationReceived", NotificationsHub.NotificationReceived);
    }

    // ---------------------------------------------------------------------------------------
    // WESAL-TASK-12 (Edit 12): the rejection service gained a dependency on the chat-hub
    // notifier so the rejection message reaches an open thread live. A missing or
    // wrongly-scoped registration for that is invisible to a compile and to every other test:
    // the service still constructs in isolation, and the only symptom in production is a 500
    // on the first rejection a hall owner performs.
    // ---------------------------------------------------------------------------------------

    [Fact]
    public void ConversationNotifier_IsRegisteredSoRejectionCanBePushedLive()
    {
        var services = BuildProductionServices();

        var descriptor = Assert.Single(services, d => d.ServiceType == typeof(IConversationNotifier));

        Assert.Equal(typeof(ConversationNotifier), descriptor.ImplementationType);
        Assert.Equal(ServiceLifetime.Scoped, descriptor.Lifetime);
    }

    [Fact]
    public void ConversationNotifier_IsConstructibleFromTheProductionContainer()
    {
        // The real proof that the new dependency is satisfiable: this resolves a live notifier
        // from the actual production registrations (including the SignalR hub context it needs)
        // rather than asserting on descriptors alone.
        var services = BuildProductionServices();
        services.AddSignalR();

        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();

        Assert.NotNull(scope.ServiceProvider.GetService<IConversationNotifier>());
    }

    /// <summary>
    /// WESAL-TASK-10 (Edit 10 follow-up): the SignalR hub now takes the shared access guard
    /// instead of resolving the repository and current user itself. If that guard were
    /// unregistered, the failure mode is a runtime exception on the first JoinConversation
    /// call rather than a startup error, so it is pinned here.
    /// </summary>
    [Fact]
    public void ConversationThreadGuard_IsRegisteredAndResolvable()
    {
        var services = BuildProductionServices();
        services.AddSignalR();

        var descriptor = Assert.Single(services, d => d.ServiceType == typeof(ConversationThreadGuard));
        Assert.Equal(ServiceLifetime.Scoped, descriptor.Lifetime);

        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();

        Assert.NotNull(scope.ServiceProvider.GetService<ConversationThreadGuard>());
    }

    /// <summary>
    /// The hub must be constructible from the production container, which is the only thing
    /// standing between a missing registration and a 500 on the first live join. SignalR does
    /// not register hub classes in DI; its default activator creates them with
    /// <c>ActivatorUtilities</c>, so that is exactly what is reproduced here.
    /// </summary>
    [Fact]
    public void ConversationHub_IsConstructibleFromTheProductionContainer()
    {
        var services = BuildProductionServices();
        services.AddSignalR();

        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();

        var hub = ActivatorUtilities.CreateInstance<ConversationHub>(scope.ServiceProvider);

        Assert.NotNull(hub);
    }
}
