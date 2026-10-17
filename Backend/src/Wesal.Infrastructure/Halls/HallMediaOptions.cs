namespace Wesal.Infrastructure.Halls;

/// <summary>
/// Configuration for hall media uploads (<c>HallMedia</c> section).
/// <para>
/// <see cref="Provider"/> selects the implementation: <c>Local</c> (default,
/// container-local filesystem for development), <c>R2</c> (durable Cloudflare
/// R2 object storage) or <c>Supabase</c> (durable public Supabase Storage
/// bucket). The choice is explicit: an unknown value fails startup rather than
/// silently falling back.
/// </para>
/// </summary>
public sealed class HallMediaOptions
{
    public const string SectionName = "HallMedia";

    public const string ProviderLocal = "Local";

    public const string ProviderR2 = "R2";

    public const string ProviderSupabase = "Supabase";

    /// <summary>Local filesystem directory. Defaults to the OS temp directory.</summary>
    public string? Directory { get; set; }

    /// <summary>Storage provider name. Defaults to <c>Local</c> when unset.</summary>
    public string? Provider { get; set; }

    /// <summary>Cloudflare R2 settings (<c>HallMedia:R2</c>). Required when <see cref="Provider"/> is R2.</summary>
    public HallMediaR2Options? R2 { get; set; }
}

/// <summary>
/// Cloudflare R2 settings for durable public hall media (<c>HallMedia:R2</c>).
/// Everything comes from environment/configuration; no credential is hardcoded.
/// Render form: <c>HallMedia__R2__ServiceUrl</c>, <c>HallMedia__R2__AccessKeyId</c>,
/// <c>HallMedia__R2__SecretAccessKey</c>, <c>HallMedia__R2__BucketName</c>,
/// <c>HallMedia__R2__PublicBaseUrl</c>.
/// </summary>
public sealed class HallMediaR2Options
{
    public string? ServiceUrl { get; set; }

    public string? AccessKeyId { get; set; }

    public string? SecretAccessKey { get; set; }

    public string? BucketName { get; set; }

    /// <summary>
    /// Public HTTPS base the browser loads images from (custom domain recommended,
    /// e.g. <c>https://media.example.com</c>). Its path must not start with
    /// <c>/uploads/</c>: the frontend re-anchors such absolute URLs to the API origin.
    /// </summary>
    public string? PublicBaseUrl { get; set; }
}
