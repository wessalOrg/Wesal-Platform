using Amazon.Runtime;
using Amazon.S3;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Wesal.Infrastructure.Halls;

/// <summary>
/// Provider selection for hall media (durable storage). Reads
/// <c>HallMedia:Provider</c> (<c>Local</c> default, <c>R2</c> for durable
/// Cloudflare R2 object storage) and registers exactly one
/// <see cref="IHallMediaStorage"/>. An unknown provider name fails startup
/// rather than silently falling back. The S3 client is a reused singleton, per
/// AWS SDK guidance (clients are thread-safe).
/// </summary>
public static class HallMediaRegistration
{
    public static IServiceCollection AddHallMediaStorage(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var provider = configuration.GetSection(HallMediaOptions.SectionName)
            .Get<HallMediaOptions>()?.Provider;

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
            $"Unknown HallMedia:Provider '{provider}'. Expected '{HallMediaOptions.ProviderLocal}' or '{HallMediaOptions.ProviderR2}'.");
    }
}
