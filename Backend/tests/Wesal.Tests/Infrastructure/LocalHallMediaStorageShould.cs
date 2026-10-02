using Microsoft.Extensions.Options;
using Wesal.Application.Common.Models;
using Wesal.Infrastructure.Halls;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Local provider contract (durable hall media, Phase 20): real files under a
/// temp root with legacy /uploads/... URLs, plus rollback deletion that can
/// neither escape the root nor throw for missing files.
/// </summary>
public sealed class LocalHallMediaStorageShould
{
    private static LocalHallMediaStorage Create(out string root)
    {
        root = Path.Combine(Path.GetTempPath(), "wesal-media-test-" + Guid.NewGuid().ToString("N"));
        return new LocalHallMediaStorage(Options.Create(new HallMediaOptions { Directory = root }));
    }

    private static HallPhotoUpload JpegUpload() => new()
    {
        FileName = "cover.JPG",
        ContentType = "image/jpeg",
        Content = [0xFF, 0xD8, 0xFF, 0xE0]
    };

    [Fact]
    public async Task SaveAsync_WritesFileAndReturnsLegacyRelativeUrl()
    {
        var storage = Create(out _);
        var hallId = Guid.NewGuid();

        var stored = await storage.SaveAsync(hallId, JpegUpload());

        Assert.StartsWith("/uploads/", stored.PublicUrl, StringComparison.Ordinal);
        Assert.Matches($"^/uploads/halls/{hallId:D}/[0-9a-f]{{32}}\\.jpg$", stored.PublicUrl);
        Assert.Equal("/uploads/" + stored.StorageKey, stored.PublicUrl);
        var fileName = stored.PublicUrl.Split('/')[^1];
        Assert.True(File.Exists(Path.Combine(storage.HallsUploadDirectory(hallId), fileName)));
    }

    [Fact]
    public async Task DeleteAsync_RemovesOnlyTheStoredFile()
    {
        var storage = Create(out _);
        var hallId = Guid.NewGuid();

        var stored = await storage.SaveAsync(hallId, JpegUpload());
        var fileName = stored.PublicUrl.Split('/')[^1];
        var diskPath = Path.Combine(storage.HallsUploadDirectory(hallId), fileName);
        Assert.True(File.Exists(diskPath));

        await storage.DeleteAsync(stored);

        Assert.False(File.Exists(diskPath));
        Assert.True(Directory.Exists(storage.HallsUploadDirectory(hallId)));
    }

    [Fact]
    public async Task DeleteAsync_MissingFile_DoesNotThrow()
    {
        var storage = Create(out _);

        await storage.DeleteAsync(new StoredHallMedia("/uploads/halls/a/b.jpg", "halls/a/b.jpg"));
    }

    [Fact]
    public async Task DeleteAsync_PathTraversalKey_StaysInsideRoot()
    {
        var storage = Create(out var root);
        var sentinel = Path.Combine(root, "sentinel.txt");
        await File.WriteAllTextAsync(sentinel, "keep");

        await storage.DeleteAsync(new StoredHallMedia("x", "../../sentinel.txt"));

        Assert.True(File.Exists(sentinel));
    }

    [Fact]
    public void Info_ExposesLocalRoot()
    {
        var storage = Create(out var root);

        Assert.True(storage.Info.IsLocal);
        Assert.Equal(root, storage.Info.LocalRoot);
    }
}
