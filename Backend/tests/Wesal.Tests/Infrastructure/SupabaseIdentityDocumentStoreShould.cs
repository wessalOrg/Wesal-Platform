using System.Net;
using System.Net.Http.Headers;
using Microsoft.Extensions.Options;
using Wesal.Domain.Exceptions;
using Wesal.Infrastructure.Documents;

namespace Wesal.Tests.Infrastructure;

public class SupabaseIdentityDocumentStoreShould
{
    private const string ProjectUrl = "https://unit.supabase.co";
    private const string SecretKey = "unit-svc-key";
    private const string FileBytes = "\uD83D\uDE80 identity";

    private static SupabaseStorageOptions StoreOptions(string? secret = null) => new()
    {
        Url = ProjectUrl,
        SecretKey = secret ?? SecretKey,
        IdentityDocumentsBucket = "identity-documents",
        TimeoutSeconds = 10
    };

    private static SupabaseIdentityDocumentStore CreateStore(
        Func<HttpRequestMessage, Task<HttpResponseMessage>> responder)
    {
        var client = new HttpClient(new FakeHttpHandler(responder), disposeHandler: false)
        {
            BaseAddress = new Uri(ProjectUrl + "/storage/v1/")
        };
        return new SupabaseIdentityDocumentStore(
            new FakeHttpClientFactory(client),
            Options.Create(StoreOptions()));
    }

    [Fact]
    public async Task SaveAsync_PostsBytesToPrivateBucketWithServerAuth()
    {
        var expected = System.Text.Encoding.UTF8.GetBytes(FileBytes);
        HttpRequestMessage? captured = null;
        byte[]? capturedBody = null;

        var store = CreateStore(async request =>
        {
            captured = request;
            capturedBody = await request.Content!.ReadAsByteArrayAsync();
            return new HttpResponseMessage(HttpStatusCode.OK);
        });

        await store.SaveAsync("/documents/owners/o-1/file.pdf", expected);

        Assert.NotNull(captured);
        Assert.Equal(HttpMethod.Post, captured!.Method);
        Assert.Equal("https://unit.supabase.co/storage/v1/object/owners/o-1/file.pdf", captured.RequestUri!.AbsoluteUri);
        // Private bucket access is enforced with the server-side key on every request...
        Assert.Equal(SecretKey, captured.Headers.GetValues("apikey").Single());
        Assert.Equal(new AuthenticationHeaderValue("Bearer", SecretKey), captured.Headers.Authorization);
        // ...and the write is idempotent so a retry after a transient failure cannot collide.
        Assert.Equal("true", captured.Headers.GetValues("x-upsert").Single());
        Assert.Equal("application/pdf", captured.Content!.Headers.ContentType!.ToString());
        Assert.Equal(expected, capturedBody);
    }

    [Fact]
    public async Task SaveAsync_RejectedUpload_ThrowsSoNoReferenceIsEverRecorded()
    {
        var store = CreateStore(async _ => new HttpResponseMessage(HttpStatusCode.BadRequest));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            store.SaveAsync("/documents/owners/o-1/file.pdf", [1, 2, 3]));

        Assert.Contains("bucket", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SaveAsync_NonOwnerPath_IsRejectedWithoutAnyRequest()
    {
        var requested = false;
        var store = CreateStore(async _ =>
        {
            requested = true;
            return new HttpResponseMessage(HttpStatusCode.OK);
        });

        await Assert.ThrowsAsync<ValidationException>(() =>
            store.SaveAsync("/documents/conversations/c1/attachments/a.png", [1]));

        Assert.False(requested);
    }

    [Fact]
    public async Task ReadAsync_ExistingObject_ReturnsBytesAndNoPublicUrl()
    {
        var payload = System.Text.Encoding.UTF8.GetBytes(FileBytes);
        HttpRequestMessage? captured = null;

        var store = CreateStore(async request =>
        {
            captured = request;
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new ByteArrayContent(payload)
            };
        });

        var result = await store.ReadAsync("/documents/owners/o-1/file.pdf");

        Assert.NotNull(result);
        Assert.Equal(payload, result!.Bytes);
        // Remote storage has no filesystem path: the caller must stream the bytes, not a URL.
        Assert.Null(result.LocalPath);
        Assert.Equal(HttpMethod.Get, captured!.Method);
        Assert.Equal("https://unit.supabase.co/storage/v1/object/owners/o-1/file.pdf", captured.RequestUri!.AbsoluteUri);
        Assert.Equal(SecretKey, captured.Headers.GetValues("apikey").Single());
    }

    [Fact]
    public async Task ReadAsync_MissingObject_ReturnsNull()
    {
        var store = CreateStore(async _ => new HttpResponseMessage(HttpStatusCode.NotFound));

        var result = await store.ReadAsync("/documents/owners/o-1/file.pdf");

        Assert.Null(result);
    }

    [Fact]
    public async Task ReadAsync_StorageFailure_ThrowsInsteadOfSwallowing()
    {
        var store = CreateStore(async _ => new HttpResponseMessage(HttpStatusCode.InternalServerError));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            store.ReadAsync("/documents/owners/o-1/file.pdf"));
    }

    [Fact]
    public async Task ReadAsync_NonOwnerPath_ReturnsNullWithoutAnyRequest()
    {
        var requested = false;
        var store = CreateStore(async _ =>
        {
            requested = true;
            return new HttpResponseMessage(HttpStatusCode.OK);
        });

        var result = await store.ReadAsync("/documents/conversations/c1/attachments/a.png");

        Assert.Null(result);
        Assert.False(requested);
    }

    [Fact]
    public async Task DeleteAsync_IsBestEffort()
    {
        var requested = false;
        var store = CreateStore(async _ =>
        {
            requested = true;
            return new HttpResponseMessage(HttpStatusCode.BadRequest);
        });

        // A failed or missing delete must not break the "remove previous document" flow.
        await store.DeleteAsync("/documents/owners/o-1/file.pdf");

        Assert.True(requested);
    }

    [Fact]
    public void ObjectKey_CannotEscapeThePrivateOwnerPrefix()
    {
        // Valid: documents/owners/{ownerId}/{fileName}
        Assert.Equal("owners/o-1/file.pdf", DocumentPath.OwnerIdentityObjectKey("/documents/owners/o-1/file.pdf"));

        // Any other shape resolves to null: never another document set, never a traversal.
        Assert.Null(DocumentPath.OwnerIdentityObjectKey("/documents/owners/o-1"));
        Assert.Null(DocumentPath.OwnerIdentityObjectKey("/documents/owners/o-1/a/b.png"));
        Assert.Null(DocumentPath.OwnerIdentityObjectKey("/documents/conversations/c1/attachments/a.png"));
        Assert.Null(DocumentPath.OwnerIdentityObjectKey("/documents/owners/../admin/secret.png"));
        Assert.Null(DocumentPath.OwnerIdentityObjectKey("/upload/halls/x.png"));
        Assert.Null(DocumentPath.OwnerIdentityObjectKey(""));
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