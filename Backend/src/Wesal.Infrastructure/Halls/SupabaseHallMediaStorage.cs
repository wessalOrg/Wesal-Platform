using System.Net.Http.Headers;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Models;
using Wesal.Infrastructure.Documents;

namespace Wesal.Infrastructure.Halls;

/// <summary>
/// Durable Supabase Storage-backed hall media provider (the production provider for
/// the PUBLIC <c>hall-images</c> bucket).
/// <para>
/// Persists validated photos as immutable objects (<c>halls/{hallId}/{guid}.{ext}</c>)
/// with the validated content type and a long cache header, and returns the object's
/// absolute PUBLIC URL (<c>{SupabaseStorage:Url}/storage/v1/object/public/{bucket}/{key}</c>)
/// that the database stores and browsers load directly. Hall images are public by design —
/// unlike identity documents and conversation attachments, which stay in private buckets and
/// are served only through authorized endpoints.
/// </para>
/// <para>
/// Writes still authenticate with the server-side secret key (never sent to the browser);
/// the bucket's public flag only governs anonymous reads, so this provider never exposes
/// credentials. Legacy API-relative <c>/uploads/...</c> rows are left untouched.
/// </para>
/// </summary>
public sealed class SupabaseHallMediaStorage : IHallMediaStorage
{
    public const string HttpClientName = "SupabaseHallMediaStorage";

    /// <summary>Immutable cache target in seconds; Supabase stores it as the object's Cache-Control.</summary>
    internal const long CacheControlSeconds = 31536000;

    /// <summary>Upper bound keeping every generated public URL inside the 500-char DB column.</summary>
    internal const int MaxPublicUrlLength = 500;

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly SupabaseStorageOptions _options;
    private readonly ILogger<SupabaseHallMediaStorage> _logger;

    public SupabaseHallMediaStorage(
        IHttpClientFactory httpClientFactory,
        IOptions<SupabaseStorageOptions> options,
        ILogger<SupabaseHallMediaStorage> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    public string Bucket => _options.HallImagesBucket;

    public HallMediaStorageInfo Info => new(false, null);

    public async Task<StoredHallMedia> SaveAsync(
        Guid hallId,
        HallPhotoUpload upload,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(upload);

        var fileName = StorageKeys.NewFileName(Path.GetExtension(upload.FileName).ToLowerInvariant());
        var key = StorageKeys.ForHallPhoto(hallId, fileName);
        var publicUrl = PublicObjectUrl(key);

        if (publicUrl.Length > MaxPublicUrlLength)
        {
            throw new InvalidOperationException(
                $"The generated hall media public URL exceeds the {MaxPublicUrlLength}-character database limit. " +
                "Use a shorter SupabaseStorage:Url.");
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{ObjectResource(key)}?cacheControl={CacheControlSeconds}")
        {
            Content = new ByteArrayContent(upload.Content)
        };
        request.Content.Headers.ContentType = new MediaTypeHeaderValue(ResolveContentType(upload, fileName));
        // Photos are written to a fresh GUID path per upload, but upsert keeps a
        // retry after a transient failure from failing with "Asset Already Exists".
        request.Headers.TryAddWithoutValidation("x-upsert", "true");

        using var response = await SendAsync(request, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var reason = await ReadBodySafelyAsync(response, cancellationToken);
            _logger.LogWarning(
                "Supabase Storage rejected the hall photo upload: status {Status}, key {Key}, reason {Reason}",
                (int)response.StatusCode,
                key,
                reason);
            // Fail loudly: recording a reference to bytes the store rejected is exactly
            // the data loss this provider exists to prevent.
            throw new InvalidOperationException(
                $"Supabase Storage rejected the hall photo upload ({(int)response.StatusCode}). " +
                $"Reason: {reason} Ensure the '{Bucket}' bucket exists and is reachable.");
        }

        return new StoredHallMedia(PublicUrl: publicUrl, StorageKey: key);
    }

    public async Task DeleteAsync(StoredHallMedia media, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(media);

        // Only ever compensate objects this request created (halls/{hallId}/{file}).
        // A malformed handle is left alone, never translated into a different path.
        if (!StorageKeys.IsValidHallPhotoKey(media.StorageKey))
        {
            return;
        }

        using var request = new HttpRequestMessage(HttpMethod.Delete, ObjectResource(media.StorageKey));

        try
        {
            using var response = await SendAsync(request, cancellationToken);
            // 404 == already gone, which is the state delete is trying to reach.
        }
        catch (InvalidOperationException)
        {
            // Best-effort cleanup; an orphaned object is harmless (never referenced).
        }
    }

    private async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient(HttpClientName);

        // Supabase Storage authenticates every request with both headers. The secret
        // key stays server-side (added here, never sent to the browser).
        request.Headers.TryAddWithoutValidation("apikey", _options.SecretKey);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.SecretKey);

        return await client.SendAsync(request, cancellationToken);
    }

    /// <summary>Reads the error body so its exact text can be logged/surfaced; never throws.</summary>
    private static async Task<string> ReadBodySafelyAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        try
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            return string.IsNullOrWhiteSpace(body) ? "(no response body)" : body.Trim();
        }
        catch (Exception)
        {
            return "(response body could not be read)";
        }
    }

    private static string ResolveContentType(HallPhotoUpload upload, string fileName)
    {
        if (!string.IsNullOrWhiteSpace(upload.ContentType))
        {
            return upload.ContentType;
        }

        return DocumentPath.ContentTypeFromUrl(fileName) ?? "application/octet-stream";
    }

    /// <summary>
    /// Storage REST resource for an object, always scoped to the configured PUBLIC
    /// bucket: <c>object/{bucket}/{halls/{hallId}/{fileName}}</c>.
    /// </summary>
    private string ObjectResource(string key)
        => $"object/{Escape(Bucket)}/{Escape(key)}";

    /// <summary>Browser-loadable absolute URL for a public-bucket object.</summary>
    private string PublicObjectUrl(string key)
        => $"{_options.Url!.TrimEnd('/')}/storage/v1/object/public/{Escape(Bucket)}/{Escape(key)}";

    /// <summary>Escapes each key segment while preserving the folder separators.</summary>
    private static string Escape(string key)
        => string.Join('/', key.Split('/').Select(Uri.EscapeDataString));
}