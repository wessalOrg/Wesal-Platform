using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Wesal.Infrastructure.Halls;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Provider selection (durable hall media, Phase 14): configuration chooses
/// exactly one storage implementation, and unknown names fail fast.
/// </summary>
public sealed class HallMediaRegistrationShould
{
    private static IConfiguration Config(string? provider, bool includeR2 = false)
    {
        var values = new Dictionary<string, string?>();
        if (provider is not null)
        {
            values["HallMedia:Provider"] = provider;
        }

        if (includeR2)
        {
            values["HallMedia:R2:ServiceUrl"] = "https://abc123.r2.cloudflarestorage.com";
            values["HallMedia:R2:AccessKeyId"] = "AKID";
            values["HallMedia:R2:SecretAccessKey"] = "SECRET";
            values["HallMedia:R2:BucketName"] = "wesal-hall-media";
            values["HallMedia:R2:PublicBaseUrl"] = "https://media.example.com";
        }

        return new ConfigurationBuilder().AddInMemoryCollection(values).Build();
    }

    private static IHallMediaStorage Resolve(IConfiguration configuration)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        // Mirrors Wesal.Infrastructure.DependencyInjection: the R2 options
        // section is bound alongside the provider switch.
        services.AddOptions<HallMediaR2Options>().Bind(configuration.GetSection("HallMedia:R2"));
        services.AddHallMediaStorage(configuration);
        return services.BuildServiceProvider().GetRequiredService<IHallMediaStorage>();
    }

    [Fact]
    public void UnsetProvider_ResolvesLocal()
    {
        Assert.IsType<LocalHallMediaStorage>(Resolve(Config(null)));
    }

    [Fact]
    public void R2Provider_ResolvesR2Storage()
    {
        // AmazonS3Client construction performs no network I/O.
        Assert.IsType<R2HallMediaStorage>(Resolve(Config("R2", includeR2: true)));
    }

    [Fact]
    public void UnknownProvider_Throws()
    {
        var services = new ServiceCollection();
        Assert.Throws<InvalidOperationException>(() => services.AddHallMediaStorage(Config("S3")));
    }
}
