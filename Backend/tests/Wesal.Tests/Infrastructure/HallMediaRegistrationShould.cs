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
    private static IConfiguration Config(string? provider, bool includeR2 = false, bool includeSupabase = false)
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

        if (includeSupabase)
        {
            values["SupabaseStorage:Url"] = "https://unit.supabase.co";
            values["SupabaseStorage:SecretKey"] = "unit-svc-key";
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
    public void SupabaseProvider_ResolvesSupabaseStorage()
    {
        var storage = Resolve(Config("Supabase", includeSupabase: true));
        var supabase = Assert.IsType<SupabaseHallMediaStorage>(storage);
        // The existing PUBLIC hall-images bucket is the default; no bucket is created.
        Assert.Equal("hall-images", supabase.Bucket);
        Assert.False(supabase.Info.IsLocal);
    }

    [Fact]
    public void SupabaseProvider_WithoutCredentials_Throws()
    {
        var services = new ServiceCollection();
        var ex = Assert.Throws<InvalidOperationException>(() => services.AddHallMediaStorage(Config("Supabase")));
        Assert.Contains("SupabaseStorage:Url", ex.Message, StringComparison.Ordinal);
        Assert.Contains("SupabaseStorage:SecretKey", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void UnknownProvider_Throws()
    {
        var services = new ServiceCollection();
        Assert.Throws<InvalidOperationException>(() => services.AddHallMediaStorage(Config("S3")));
    }
}
