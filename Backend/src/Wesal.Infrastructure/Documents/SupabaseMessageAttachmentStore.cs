using System.Net.Http.Headers;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;
using Wesal.Domain.Exceptions;

namespace Wesal.Infrastructure.Documents;

/// <summary>
/// Supabase Storage-backed store for conversation message attachments.
///
/// Reads and writes go straight to a PRIVATE bucket with the server-side secret key;
/// the caller only ever receives bytes. No public URL is produced, no signed URL is
/// requested, and the bucket is never exposed through a static-file mapping — the only
/// way to reach an attachment is the protected endpoint that already passed the
/// conversation's participant check. This is the durable half of the message-attachment
/// fix: the local copy keeps serving as the hot path, this store keeps the bytes across
/// instance replacements and redeploys.
///
/// The object key is derived exclusively from the persisted relative URL and rejected
/// unless it is exactly <c>conversations/{conversationId}/attachments/{fileName}</c>, so
/// a corrupted record can neither traverse out of the bucket prefix nor address another
/// attachment set. Uploads use the fresh-GUID path already persisted in the message row.
/// </summary>
public sealed class SupabaseMessageAttachmentStore : IMessageAttachmentStore
{
    public const string HttpClientName = "SupabaseMessageAttachmentStorage";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly SupabaseStorageOptions _options;
    private readonly ILogger<SupabaseMessageAttachmentStore> _logger;

    public SupabaseMessageAttachmentStore(
        IHttpClientFactory httpClientFactory,
        IOptions<SupabaseStorageOptions> options,
        ILogger<SupabaseMessageAttachmentStore> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    public bool IsDurable => true;

    public async Task StoreAsync(string relativeUrl, byte[] content, CancellationToken cancellationToken = default)
    {
        var key = RequireKey(relativeUrl);

        using var request = new HttpRequestMessage(HttpMethod.Post, ObjectResource(key))
        {
            Content = new ByteArrayContent(content)
        };
        request.Content.Headers.ContentType = new MediaTypeHeaderValue(DocumentPath.ContentTypeFromUrl(relativeUrl));
        // Attachments are written to a fresh GUID path per upload, but upsert keeps a
        // retry after a transient failure from failing with "Asset Already Exists".
        request.Headers.TryAddWithoutValidation("x-upsert", "true");

        using var response = await SendAsync(request, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var reason = await ReadBodySafelyAsync(response, cancellationToken);
            _logger.LogWarning(
                "Supabase Storage rejected the conversation attachment upload: status {Status}, key {Key}, reason {Reason}",
                (int)response.StatusCode,
                key,
                reason);
            // Fail loudly: recording a row that references bytes which will not survive a
            // redeploy is exactly the data loss this store exists to prevent.
            throw new InvalidOperationException(
                $"Supabase Storage rejected the conversation attachment upload ({(int)response.StatusCode}). " +
                $"Reason: {reason} Ensure the '{_options.ConversationAttachmentsBucket}' bucket exists and is reachable.");
        }
    }

    public async Task<StoredDocumentContent?> TryReadAsync(string relativeUrl, CancellationToken cancellationToken = default)
    {
        var key = DocumentPath.ConversationAttachmentObjectKey(relativeUrl);
        if (key is null)
        {
            return null;
        }

        using var request = new HttpRequestMessage(HttpMethod.Get, ObjectResource(key));
        using var response = await SendAsync(request, cancellationToken);

        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Supabase Storage could not read the conversation attachment ({(int)response.StatusCode}).");
        }

        return new StoredDocumentContent
        {
            Bytes = await response.Content.ReadAsByteArrayAsync(cancellationToken),
            LocalPath = null
        };
    }

    public async Task DeleteAsync(string relativeUrl, CancellationToken cancellationToken = default)
    {
        var key = DocumentPath.ConversationAttachmentObjectKey(relativeUrl);
        if (key is null)
        {
            return;
        }

        using var request = new HttpRequestMessage(HttpMethod.Delete, ObjectResource(key));

        try
        {
            using var response = await SendAsync(request, cancellationToken);
            // 404 == already gone, which is the state delete is trying to reach.
        }
        catch (InvalidOperationException)
        {
            // Best-effort cleanup; an orphaned object is harmless (never served publicly).
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

    private string RequireKey(string relativeUrl)
        => DocumentPath.ConversationAttachmentObjectKey(relativeUrl)
           ?? throw new ValidationException("The conversation attachment path is not valid.");

    /// <summary>
    /// Storage REST resource for an object, always scoped to the configured private
    /// bucket: <c>object/{bucket}/{conversations/{conversationId}/attachments/{fileName}}</c>.
    /// The bucket is a transport-level part of the request path only — the persisted
    /// relative URL and the validated object key stay bucket-relative.
    /// </summary>
    private string ObjectResource(string key)
        => $"object/{Escape(_options.ConversationAttachmentsBucket)}/{Escape(key)}";

    /// <summary>Escapes each key segment while preserving the folder separators.</summary>
    private static string Escape(string key)
        => string.Join('/', key.Split('/').Select(Uri.EscapeDataString));
}