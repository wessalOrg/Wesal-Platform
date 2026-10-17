using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Wesal.Application.Common.Interfaces;

namespace Wesal.Infrastructure.Documents;

/// <summary>
/// One-time startup backfill: uploads any message-attachment files still present on the
/// (ephemeral) container disk into the durable store, so images sent before the durable
/// store existed keep working after the next instance replacement/redeploy.
///
/// No-op when no durable store is configured (development/tests). Best-effort by design:
/// a file that cannot be uploaded is logged and skipped — the boot must never fail because
/// a backfill upload was rejected, and the durable write path still fails loudly for any
/// NEW attachment, so a hard storage outage stays visible there instead.
/// </summary>
public sealed class ConversationAttachmentBackfillService : IHostedService
{
    private readonly IDocumentStorage _documentStorage;
    private readonly IMessageAttachmentStore _store;
    private readonly ILogger<ConversationAttachmentBackfillService> _logger;

    public ConversationAttachmentBackfillService(
        IDocumentStorage documentStorage,
        IMessageAttachmentStore store,
        ILogger<ConversationAttachmentBackfillService> logger)
    {
        _documentStorage = documentStorage;
        _store = store;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
        => BackfillAsync(cancellationToken);

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private async Task BackfillAsync(CancellationToken cancellationToken)
    {
        if (!_store.IsDurable)
        {
            _logger.LogInformation("Conversation attachment backfill skipped: no durable store configured.");
            return;
        }

        var conversationsRoot = Path.Combine(_documentStorage.Root, "documents", "conversations");
        if (!Directory.Exists(conversationsRoot))
        {
            _logger.LogInformation("Conversation attachment backfill: no local attachments to backfill.");
            return;
        }

        var uploaded = 0;
        var failed = 0;

        foreach (var conversationDirectory in Directory.EnumerateDirectories(conversationsRoot))
        {
            var attachmentsDirectory = Path.Combine(conversationDirectory, "attachments");
            if (!Directory.Exists(attachmentsDirectory))
            {
                continue;
            }

            var conversationSegment = Path.GetFileName(conversationDirectory);

            foreach (var file in Directory.EnumerateFiles(attachmentsDirectory))
            {
                var relativeUrl = $"/documents/conversations/{conversationSegment}/attachments/{Path.GetFileName(file)}";

                // Only upload paths the durable store would accept, mirroring the strict
                // bucket-relative key check used by every read/write.
                if (DocumentPath.ConversationAttachmentObjectKey(relativeUrl) is null)
                {
                    failed++;
                    _logger.LogWarning("Conversation attachment backfill skipped malformed path: {Path}", relativeUrl);
                    continue;
                }

                try
                {
                    var bytes = await File.ReadAllBytesAsync(file, cancellationToken);
                    await _store.StoreAsync(relativeUrl, bytes, cancellationToken);
                    uploaded++;
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    failed++;
                    _logger.LogWarning(ex, "Conversation attachment backfill failed for {Path}", relativeUrl);
                }
            }
        }

        _logger.LogInformation(
            "Conversation attachment backfill complete: {Uploaded} uploaded, {Failed} failed.",
            uploaded,
            failed);
    }
}