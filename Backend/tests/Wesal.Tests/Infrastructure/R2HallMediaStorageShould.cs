using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Options;
using Moq;
using Wesal.Application.Common.Models;
using Wesal.Infrastructure.Halls;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// R2 provider contract (durable hall media, Phase 20): immutable keys, absolute
/// public URLs, correct metadata. S3 is mocked; no real credentials are needed.
/// </summary>
public sealed class R2HallMediaStorageShould
{
    private const string Base = "https://media.example.com/";
    private const string Bucket = "wesal-hall-media";

    private static HallMediaR2Options ValidOptions() => new()
    {
        ServiceUrl = "https://abc123.r2.cloudflarestorage.com",
        AccessKeyId = "AKID",
        SecretAccessKey = "SECRET",
        BucketName = Bucket,
        PublicBaseUrl = Base
    };

    private static HallPhotoUpload JpegUpload(string fileName = "My Photo.JPG") => new()
    {
        FileName = fileName,
        ContentType = "image/jpeg",
        Content = [0xFF, 0xD8, 0xFF, 0xE0, 0x00]
    };

    private static (R2HallMediaStorage Storage, Mock<IAmazonS3> S3, PutObjectRequest? Captured) Create()
    {
        var s3 = new Mock<IAmazonS3>(MockBehavior.Strict);
        PutObjectRequest? captured = null;
        s3.Setup(s => s.PutObjectAsync(It.IsAny<PutObjectRequest>(), It.IsAny<CancellationToken>()))
            .Callback<PutObjectRequest, CancellationToken>((request, _) => captured = request)
            .ReturnsAsync(new PutObjectResponse());
        s3.Setup(s => s.DeleteObjectAsync(It.IsAny<DeleteObjectRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DeleteObjectResponse());
        var storage = new R2HallMediaStorage(s3.Object, Options.Create(ValidOptions()));
        return (storage, s3, captured);
    }

    [Fact]
    public async Task SaveAsync_ProducesImmutableKeyAndAbsoluteUrl()
    {
        var (storage, _, _) = Create();
        var hallId = Guid.NewGuid();

        var stored = await storage.SaveAsync(hallId, JpegUpload("My Photo.JPG"));

        Assert.Matches($"^halls/{hallId:D}/[0-9a-f]{{32}}\\.jpg$", stored.StorageKey);
        Assert.Equal($"https://media.example.com/{stored.StorageKey}", stored.PublicUrl);
        Assert.DoesNotContain("My Photo", stored.StorageKey, StringComparison.Ordinal);
        Assert.DoesNotContain(" ", stored.StorageKey, StringComparison.Ordinal);
    }

    [Fact]
    public async Task SaveAsync_SendsContentTypeAndImmutableCacheHeader()
    {
        var s3 = new Mock<IAmazonS3>(MockBehavior.Strict);
        PutObjectRequest? captured = null;
        var capturedLength = 0L;
        s3.Setup(s => s.PutObjectAsync(It.IsAny<PutObjectRequest>(), It.IsAny<CancellationToken>()))
            .Callback<PutObjectRequest, CancellationToken>((request, _) =>
            {
                captured = request;
                // Read inside the callback: the provider disposes the stream afterwards.
                using var copy = new MemoryStream();
                request.InputStream.CopyTo(copy);
                capturedLength = copy.Length;
            })
            .ReturnsAsync(new PutObjectResponse());
        var probing = new R2HallMediaStorage(s3.Object, Options.Create(ValidOptions()));
        await probing.SaveAsync(Guid.NewGuid(), JpegUpload());

        Assert.NotNull(captured);
        Assert.Equal(Bucket, captured!.BucketName);
        Assert.Equal("image/jpeg", captured.ContentType);
        Assert.Equal("public, max-age=31536000, immutable", captured.Headers.CacheControl);
        Assert.Equal(5, capturedLength);
    }

    [Fact]
    public async Task DeleteAsync_DeletesExactBucketAndKey()
    {
        var (storage, s3, _) = Create();
        var media = new StoredHallMedia("https://media.example.com/halls/abc/def.jpg", "halls/abc/def.jpg");

        await storage.DeleteAsync(media);

        s3.Verify(s => s.DeleteObjectAsync(
            It.Is<DeleteObjectRequest>(r => r.BucketName == Bucket && r.Key == "halls/abc/def.jpg"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public void Info_IsNotLocal()
    {
        var (storage, _, _) = Create();

        Assert.False(storage.Info.IsLocal);
        Assert.Null(storage.Info.LocalRoot);
    }
}
