using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.Halls;

/// <summary>
/// Durable handle for one persisted hall photo.
/// <para>
/// <see cref="PublicUrl"/> is what the database stores and browsers load: a legacy
/// API-relative <c>/uploads/...</c> URL for the local provider, or an absolute R2
/// public URL for the R2 provider.
/// </para>
/// <para>
/// <see cref="StorageKey"/> is the provider-internal locator used for rollback
/// cleanup (<c>halls/{hallId}/{file}</c> for both providers; a relative key for
/// local disk, the R2 object key for Cloudflare R2). It never leaves the server
/// and never contains credentials.
/// </para>
/// </summary>
public sealed record StoredHallMedia(string PublicUrl, string StorageKey);

/// <summary>
/// Provider metadata for <see cref="IHallMediaStorage"/>. Lets hosting code serve
/// legacy local files without assuming every provider has a filesystem root.
/// </summary>
public sealed record HallMediaStorageInfo(bool IsLocal, string? LocalRoot);

/// <summary>
/// Hall photo persistence behind a provider-neutral contract (durable media).
/// Implementations own the bytes end to end: validation stays in
/// <see cref="HallPhotoUploadValidator"/> (MIME, signature, size, extension),
/// while the provider assigns the immutable storage key, persists the content,
/// and returns the public URL to store. Callers must never touch
/// <c>System.IO</c> file APIs for hall media directly.
/// </summary>
public interface IHallMediaStorage
{
    /// <summary>
    /// Persists one validated upload for <paramref name="hallId"/> and returns its
    /// durable handle. The upload itself is not validated here.
    /// </summary>
    Task<StoredHallMedia> SaveAsync(
        Guid hallId,
        HallPhotoUpload upload,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Best-effort-capable removal of one previously stored object, used for
    /// rollback compensation. Callers log and swallow failures so cleanup never
    /// masks the original business/database exception. Must only ever be called
    /// with handles this request created — never history or other halls' media.
    /// </summary>
    Task DeleteAsync(
        StoredHallMedia media,
        CancellationToken cancellationToken = default);

    HallMediaStorageInfo Info { get; }
}
