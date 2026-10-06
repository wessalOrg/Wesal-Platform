using System.Net;
using System.Net.Http.Headers;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Models;
using Wesal.Infrastructure.Documents;
using Wesal.Infrastructure.Halls;

namespace Wesal.Tests.Infrastructure;

public class SupabaseHallMediaStorageShould
{
    private const string ProjectUrl = "https://unit.supabase.co";
    private const string SecretKey = "unit-svc-key";

    private static readonly Guid HallId = Guid.Parse("b3d7b4b3-6f9a-4b0c-9a1e-000000000001");

    private static SupabaseStorageOptions StoreOptions(string? bucket = null) => new()
    {
        Url = ProjectUrl,
        SecretKey = SecretKey,
        HallImagesBucket = bucket ?? "hall-images",
        TimeoutSeconds = 10
    };

    private static SupabaseHallMediaStorage CreateStore(
        Func<HttpRequestMessage, Task<HttpResponseMessage>> responder,
        string? bucket = null)
    {
        var client = new HttpClient(new FakeHttpHandler(responder), disposeHandler: false)
        {
            BaseAddress = new Uri(ProjectUrl + "/storage/v1/")
        };
        return new SupabaseHallMediaStorage(
            new FakeHttpClientFactory(client),
            Options.Create(StoreOptions(bucket: bucket)),
            NullLogger<SupabaseHallMediaStorage>.Instance);
    }

    private static HallPhotoUpload JpegUpload(string fileName = "cover.jpg") => new()
    {
        FileName = fileName,
        ContentType = "image/jpeg",
        Content = [0xFF, 0xD8, 0xFF, 0xE0]
    };

    [Fact]
    public async Task SaveAsync_PostsToPublicBucket_ReturnsDurablePublicUrl()
    {
        var expected = JpegUpload().Content;
        HttpRequestMessage? captured = null;
        byte[]? capturedBody = null;

        var store = CreateStore(async request =>
        {
            captured = request;
            capturedBody = await request.Content!.ReadAsByteArrayAsync();
            return new HttpResponseMessage(HttpStatusCode.OK);
        });

        var result = await store.SaveAsync(HallId, JpegUpload());

        Assert.NotNull(captured);
        Assert.Equal(HttpMethod.Post, captured!.Method);
        // Uploads authenticate with the server-side key against the existing PUBLIC
        // hall-images bucket — object/{bucket}/{halls/{hallId}/{file}}.
        Assert.StartsWith(
            $"https://unit.supabase.co/storage/v1/object/hall-images/halls/{HallId:D}/",
            captured.RequestUri!.AbsoluteUri,
            StringComparison.Ordinal);
        // Long immutable cache header so the browser never refetches (same intent as R2).
        Assert.Contains("?cacheControl=31536000", captured.RequestUri!.Query, StringComparison.Ordinal);
        Assert.Equal(SecretKey, captured.Headers.GetValues("apikey").Single());
        Assert.Equal(new AuthenticationHeaderValue("Bearer", SecretKey), captured.Headers.Authorization);
        Assert.Equal("true", captured.Headers.GetValues("x-upsert").Single());
        Assert.Equal("image/jpeg", captured.Content!.Headers.ContentType!.ToString());
        Assert.Equal(expected, capturedBody);

        // The storage key stays server-side; the database + browser see the absolute
        // PUBLIC object URL, which the frontend passes through unchanged.
        Assert.StartsWith($"halls/{HallId:D}/", result.StorageKey, StringComparison.Ordinal);
        Assert.EndsWith(".jpg", result.StorageKey, StringComparison.Ordinal);
        Assert.Equal($"https://unit.supabase.co/storage/v1/object/public/hall-images/{result.StorageKey}", result.PublicUrl);
        Assert.False(store.Info.IsLocal);
    }

    [Fact]
    public async Task SaveAsync_RejectedUpload_ThrowsSoNoReferenceIsEverRecorded()
    {
        var store = CreateStore(async _ => new HttpResponseMessage(HttpStatusCode.BadRequest)
        {
            Content = new StringContent("Bucket not found or unavailable for writes")
        });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            store.SaveAsync(HallId, JpegUpload()));

        // The storage's own rejection reason is preserved so failures are diagnosable
        // without a live probe, and the bucket is named so a missing bucket is obvious.
        Assert.Contains("(400)", ex.Message, StringComparison.Ordinal);
        Assert.Contains("Bucket not found or unavailable for writes", ex.Message, StringComparison.Ordinal);
        Assert.Contains("hall-images", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task SaveAsync_UsesConfiguredBucket_NotHardcoded()
    {
        HttpRequestMessage? captured = null;
        var store = CreateStore(async request =>
        {
            captured = request;
            return new HttpResponseMessage(HttpStatusCode.OK);
        }, bucket: "public-hall-media");

        var result = await store.SaveAsync(HallId, JpegUpload());

        Assert.StartsWith(
            $"https://unit.supabase.co/storage/v1/object/public-hall-media/halls/{HallId:D}/",
            captured!.RequestUri!.AbsoluteUri,
            StringComparison.Ordinal);
        Assert.Contains("/object/public/public-hall-media/", result.PublicUrl, StringComparison.Ordinal);
    }

    [Fact]
    public async Task DeleteAsync_TargetsOwnObjectKey_BestEffort()
    {
        HttpRequestMessage? captured = null;
        var store = CreateStore(async request =>
        {
            captured = request;
            return new HttpResponseMessage(HttpStatusCode.BadRequest);
        });

        var media = new StoredHallMedia(
            $"https://unit.supabase.co/storage/v1/object/public/hall-images/halls/{HallId:D}/a.jpg",
            $"halls/{HallId:D}/a.jpg");

        // A failed delete is compensation cleanup only and must never break the flow.
        await store.DeleteAsync(media);

        Assert.NotNull(captured);
        Assert.Equal(HttpMethod.Delete, captured!.Method);
        Assert.Equal(
            $"https://unit.supabase.co/storage/v1/object/hall-images/halls/{HallId:D}/a.jpg",
            captured.RequestUri!.AbsoluteUri);
    }

    [Fact]
    public async Task DeleteAsync_MalformedKey_DoesNothing()
    {
        var requested = false;
        var store = CreateStore(async _ =>
        {
            requested = true;
            return new HttpResponseMessage(HttpStatusCode.OK);
        });

        // A handle that is not a hall-media key (another storage domain, a traversal,
        // a container root) is never translated into a different object path.
        await store.DeleteAsync(new StoredHallMedia("https://media.test/x", "conversations/c1/a.png"));
        await store.DeleteAsync(new StoredHallMedia("https://media.test/x", "halls/not-a-guid/a.jpg"));
        await store.DeleteAsync(new StoredHallMedia("https://media.test/x", ""));

        Assert.False(requested);
    }

    private sealed class FakeHttpHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, Task<HttpResponseMessage>> _responder;

        public FakeHttpHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> responder) => _responder = responder;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => _responder(request);
    }

    private sealed class FakeHttpClientFactory : IHttpClientFactory
    {
        private readonly HttpClient _client;

        public FakeHttpClientFactory(HttpClient client) => _client = client;

        public HttpClient CreateClient(string name) => _client;
    }
}