using Amazon.Runtime;
using Amazon.S3;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Wesal.Infrastructure.Documents;

namespace Wesal.Infrastructure.Halls;

/// <summary>Active hall media provider for startup diagnostics (names settings, never secrets).</summary>
public sealed record HallMediaStorageDiagnostics(string Provider, string? Bucket, bool IsDurable);

/// <summary>
/// Provider selection for hall media (durable storage). Reads
/// <c>HallMedia:Provider</c> (<c>Local</c> default, <c>R2</c> for durable
/// Cloudflare R2 object storage, <c>Supabase</c> for durable public Supabase
/// Storage) and registers exactly one <see cref="IHallMediaStorage"/>. An
/// unknown provider name fails startup rather than silently falling back. The
/// S3 client is a reused singleton, per AWS SDK guidance (clients are
/// thread-safe).
/// </summary>
public static class HallMediaRegistration
{
    public static IServiceCollection AddHallMediaStorage(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var provider = configuration.GetSection(HallMediaOptions.SectionName)
            .Get<HallMediaOptions>()?.Provider;

        services.AddOptions<SupabaseStorageOptions>()
            .Bind(configuration.GetSection(SupabaseStorageOptions.SectionName));

        if (string.Equals(provider, HallMediaOptions.ProviderSupabase, StringComparison.OrdinalIgnoreCase))
        {
            var supabase = configuration.GetSection(SupabaseStorageOptions.SectionName)
                .Get<SupabaseStorageOptions>() ?? new SupabaseStorageOptions();

            if (!supabase.IsConfigured)
            {
                throw new InvalidOperationException(
                    $"HallMedia:Provider is '{HallMediaOptions.ProviderSupabase}' but SupabaseStorage:Url / SupabaseStorage:SecretKey are missing or empty.");
            }

            services.AddHttpClient(SupabaseHallMediaStorage.HttpClientName, (sp, client) =>
            {
                var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<SupabaseStorageOptions>>().Value;
                client.BaseAddress = new Uri(options.Url!.TrimEnd('/') + "/storage/v1/");
                client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds > 0 ? options.TimeoutSeconds : 30);
            });

            services.AddSingleton<IHallMediaStorage, SupabaseHallMediaStorage>();
            return services;
        }

        if (string.Equals(provider, HallMediaOptions.ProviderR2, StringComparison.OrdinalIgnoreCase))
        {
            services.AddSingleton<IAmazonS3>(sp =>
            {
                var r2 = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<HallMediaR2Options>>().Value;
                // AuthenticationRegion "auto" is required: SigV4 signing needs a region
                // even against R2's custom endpoint (the SDK throws without one).
                return new AmazonS3Client(
                    new BasicAWSCredentials(r2.AccessKeyId, r2.SecretAccessKey),
                    new AmazonS3Config { ServiceURL = r2.ServiceUrl, AuthenticationRegion = "auto" });
            });
            services.AddSingleton<IHallMediaStorage, R2HallMediaStorage>();
            return services;
        }

        if (string.IsNullOrWhiteSpace(provider)
            || string.Equals(provider, HallMediaOptions.ProviderLocal, StringComparison.OrdinalIgnoreCase))
        {
            services.AddSingleton<IHallMediaStorage, LocalHallMediaStorage>();
            return services;
        }

        throw new InvalidOperationException(
            $"Unknown HallMedia:Provider '{provider}'. Expected '{HallMediaOptions.ProviderLocal}', " +
            $"'{HallMediaOptions.ProviderR2}' or '{HallMediaOptions.ProviderSupabase}'.");
    }

    /// <summary>Active provider for startup diagnostics (names settings, never secrets).</summary>
    public static HallMediaStorageDiagnostics DescribeHallMediaStorage(IConfiguration configuration)
    {
        var provider = configuration.GetSection(HallMediaOptions.SectionName)
            .Get<HallMediaOptions>()?.Provider;

        var supabase = configuration.GetSection(SupabaseStorageOptions.SectionName)
            .Get<SupabaseStorageOptions>() ?? new SupabaseStorageOptions();

        if (string.Equals(provider, HallMediaOptions.ProviderSupabase, StringComparison.OrdinalIgnoreCase))
        {
            return new HallMediaStorageDiagnostics(
                HallMediaOptions.ProviderSupabase,
                supabase.HallImagesBucket,
                IsDurable: true);
        }

        if (string.Equals(provider, HallMediaOptions.ProviderR2, StringComparison.OrdinalIgnoreCase))
        {
            var r2 = configuration.GetSection($"{HallMediaOptions.SectionName}:R2")
                .Get<HallMediaR2Options>();
            return new HallMediaStorageDiagnostics(
                HallMediaOptions.ProviderR2,
                r2?.BucketName,
                IsDurable: true);
        }

        return new HallMediaStorageDiagnostics(
            string.IsNullOrWhiteSpace(provider) ? HallMediaOptions.ProviderLocal : provider!,
            Bucket: null,
            IsDurable: false);
    }
}