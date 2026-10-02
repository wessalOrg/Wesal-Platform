namespace Wesal.Infrastructure.Halls;

/// <summary>
/// Startup validation for <see cref="HallMediaR2Options"/> (durable media).
/// Fails clearly with configuration errors naming the SETTING (never secret
/// values) so a misconfigured deployment stops at boot instead of 500ing the
/// first upload. Pure function: directly unit-testable without DI.
/// </summary>
public static class HallMediaR2Configuration
{
    public sealed record ValidatedR2Options(
        string ServiceUrl,
        string AccessKeyId,
        string SecretAccessKey,
        string BucketName,
        string PublicBaseUrl);

    public static ValidatedR2Options Validate(HallMediaR2Options? options, bool isDevelopment)
    {
        var missing = new List<string>();
        if (options is null)
        {
            throw new InvalidOperationException(
                "Hall media provider is 'R2' but the HallMedia:R2 configuration section is missing. " +
                "Set HallMedia__R2__ServiceUrl, HallMedia__R2__AccessKeyId, " +
                "HallMedia__R2__SecretAccessKey, HallMedia__R2__BucketName and HallMedia__R2__PublicBaseUrl.");
        }

        if (string.IsNullOrWhiteSpace(options.ServiceUrl)) missing.Add("HallMedia:R2:ServiceUrl");
        if (string.IsNullOrWhiteSpace(options.AccessKeyId)) missing.Add("HallMedia:R2:AccessKeyId");
        if (string.IsNullOrWhiteSpace(options.SecretAccessKey)) missing.Add("HallMedia:R2:SecretAccessKey");
        if (string.IsNullOrWhiteSpace(options.BucketName)) missing.Add("HallMedia:R2:BucketName");
        if (string.IsNullOrWhiteSpace(options.PublicBaseUrl)) missing.Add("HallMedia:R2:PublicBaseUrl");

        if (missing.Count > 0)
        {
            throw new InvalidOperationException(
                "Hall media provider is 'R2' but required settings are missing: " +
                string.Join(", ", missing) + ".");
        }

        if (!Uri.TryCreate(options.ServiceUrl!.Trim(), UriKind.Absolute, out var serviceUri)
            || (serviceUri.Scheme != Uri.UriSchemeHttp && serviceUri.Scheme != Uri.UriSchemeHttps))
        {
            throw new InvalidOperationException(
                "HallMedia:R2:ServiceUrl must be an absolute http(s) URL " +
                "(e.g. https://<ACCOUNT_ID>.r2.cloudflarestorage.com).");
        }

        var publicBase = options.PublicBaseUrl!.Trim().TrimEnd('/');
        if (!Uri.TryCreate(publicBase, UriKind.Absolute, out var publicUri)
            || (publicUri.Scheme != Uri.UriSchemeHttp && publicUri.Scheme != Uri.UriSchemeHttps))
        {
            throw new InvalidOperationException(
                "HallMedia:R2:PublicBaseUrl must be an absolute http(s) URL (e.g. https://media.example.com).");
        }

        if (!isDevelopment && !string.Equals(publicUri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "HallMedia:R2:PublicBaseUrl must use https outside Development.");
        }

        if (!string.IsNullOrEmpty(publicUri.UserInfo))
        {
            throw new InvalidOperationException(
                "HallMedia:R2:PublicBaseUrl must not embed credentials.");
        }

        if (!string.IsNullOrEmpty(publicUri.Query) || !string.IsNullOrEmpty(publicUri.Fragment))
        {
            throw new InvalidOperationException(
                "HallMedia:R2:PublicBaseUrl must not contain a query string or fragment.");
        }

        if (publicUri.AbsolutePath.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "HallMedia:R2:PublicBaseUrl must not start with /uploads/: the frontend " +
                "re-anchors such absolute URLs back to the API origin.");
        }

        if (publicBase.Length > R2HallMediaStorage.MaxPublicBaseUrlLength)
        {
            throw new InvalidOperationException(
                "HallMedia:R2:PublicBaseUrl is too long to keep generated URLs inside the 500-character database limit.");
        }

        return new ValidatedR2Options(
            options.ServiceUrl!.Trim(),
            options.AccessKeyId!.Trim(),
            options.SecretAccessKey!,
            options.BucketName!.Trim(),
            publicBase);
    }
}
