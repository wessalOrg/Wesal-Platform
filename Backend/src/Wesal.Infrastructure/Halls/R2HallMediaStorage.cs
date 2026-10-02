using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.Halls;

/// <summary>
/// Durable Cloudflare R2 hall-media provider (S3-compatible API via the official
/// AWS SDK for .NET — no hand-rolled request signing).
/// <para>
/// Persists photos as immutable objects (<c>halls/{hallId}/{guid}.{ext}</c>) with
/// the validated content type and a long immutable cache header, and returns an
/// absolute public URL (<c>{PublicBaseUrl}/{key}</c>) that the database stores
/// and browsers load directly. Public hall images only — never identity
/// documents or private attachments.
/// </para>
/// </summary>
public sealed class R2HallMediaStorage : IHallMediaStorage
{
    internal const string CacheHeaderValue = "public, max-age=31536000, immutable";

    /// <summary>Upper bound keeping every generated public URL inside the 500-char DB column.</summary>
    internal const int MaxPublicBaseUrlLength = 400;

    private readonly IAmazonS3 _s3;
    private readonly string _bucketName;
    private readonly string _publicBaseUrl;

    public R2HallMediaStorage(IAmazonS3 s3Client, IOptions<HallMediaR2Options> options)
    {
        _s3 = s3Client ?? throw new ArgumentNullException(nameof(s3Client));
        // R2 endpoints are always https, so the constructor validates with production
        // rules; environment-specific startup validation additionally runs in Program.
        var validated = HallMediaR2Configuration.Validate(options.Value, isDevelopment: false);
        _bucketName = validated.BucketName;
        _publicBaseUrl = validated.PublicBaseUrl;
    }

    public HallMediaStorageInfo Info => new(false, null);

    public async Task<StoredHallMedia> SaveAsync(
        Guid hallId,
        HallPhotoUpload upload,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(upload);

        var fileName = StorageKeys.NewFileName(Path.GetExtension(upload.FileName).ToLowerInvariant());
        var key = StorageKeys.ForHallPhoto(hallId, fileName);
        var publicUrl = $"{_publicBaseUrl}/{key}";

        if (publicUrl.Length > 500)
        {
            throw new InvalidOperationException(
                "The generated hall media public URL exceeds the 500-character database limit. " +
                "Use a shorter HallMedia:R2:PublicBaseUrl.");
        }

        using var content = new MemoryStream(upload.Content, writable: false);
        var request = new PutObjectRequest
        {
            BucketName = _bucketName,
            Key = key,
            InputStream = content,
            ContentType = upload.ContentType
        };
        request.Headers.CacheControl = CacheHeaderValue;

        await _s3.PutObjectAsync(request, cancellationToken);

        return new StoredHallMedia(PublicUrl: publicUrl, StorageKey: key);
    }

    public async Task DeleteAsync(StoredHallMedia media, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(media);

        await _s3.DeleteObjectAsync(new DeleteObjectRequest
        {
            BucketName = _bucketName,
            Key = media.StorageKey
        }, cancellationToken);
    }
}
