using Microsoft.Extensions.Options;
using Wesal.Application.Common.Models;

namespace Wesal.Infrastructure.Halls;

/// <summary>
/// Local filesystem hall-media provider for development and tests.
/// Persists photos under <c>{root}/halls/{hallId}/{guid}.{ext}</c> and returns
/// the legacy API-relative URL (<c>/uploads/halls/{hallId}/{file}</c>) that the
/// API static-file mount serves. Not durable across container replacement:
/// production must select the R2 provider instead.
/// </summary>
public sealed class LocalHallMediaStorage : IHallMediaStorage
{
    private readonly string _root;

    public LocalHallMediaStorage(IOptions<HallMediaOptions> options)
    {
        var configured = options.Value.Directory;
        _root = string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(Path.GetTempPath(), "wesal-media")
            : Path.GetFullPath(configured);
        Directory.CreateDirectory(_root);
    }

    public HallMediaStorageInfo Info => new(true, _root);

    public string Root => _root;

    public string HallsUploadDirectory(Guid hallId) => Path.Combine(_root, "halls", hallId.ToString());

    public async Task<StoredHallMedia> SaveAsync(
        Guid hallId,
        HallPhotoUpload upload,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(upload);

        var fileName = StorageKeys.NewFileName(Path.GetExtension(upload.FileName).ToLowerInvariant());
        var directory = HallsUploadDirectory(hallId);
        Directory.CreateDirectory(directory);

        var fullPath = Path.Combine(directory, fileName);
        await File.WriteAllBytesAsync(fullPath, upload.Content, cancellationToken);

        var key = StorageKeys.ForHallPhoto(hallId, fileName);
        return new StoredHallMedia(PublicUrl: $"/uploads/{key}", StorageKey: key);
    }

    public Task DeleteAsync(StoredHallMedia media, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(media);

        var fullPath = Path.GetFullPath(Path.Combine(_root, media.StorageKey));
        if (fullPath.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)
            && File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }

        return Task.CompletedTask;
    }
}
