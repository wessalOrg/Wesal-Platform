using Microsoft.Extensions.Logging.Abstractions;
using Wesal.Application.Common.Interfaces;
using Wesal.Infrastructure.Documents;
using Wesal.Infrastructure.Conversations;

using Wesal.Tests.TestDoubles;

namespace Wesal.Tests.Infrastructure;

/// <summary>
/// Pins the conversation-attachment backfill: locally surviving attachment files are
/// mirrored into the durable store at startup, and each failure mode is best-effort.
/// </summary>
public sealed class ConversationAttachmentBackfillShould : IDisposable
{
    private readonly string _root;

    public ConversationAttachmentBackfillShould()
    {
        _root = Path.Combine(Path.GetTempPath(), "wesal-backfill-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_root);
    }

    public void Dispose()
    {
        try
        {
            if (Directory.Exists(_root))
            {
                Directory.Delete(_root, recursive: true);
            }
        }
        catch (IOException)
        {
            // Best-effort cleanup; a leftover temp directory must not fail the suite.
        }
    }

    private sealed class FakeStorage : IDocumentStorage
    {
        public FakeStorage(string root) => Root = root;

        public string Root { get; }

        public string OwnerDocumentsDirectory(string ownerId) => Path.Combine(Root, "documents", "owners", ownerId);

        public string ConversationAttachmentsDirectory(Guid conversationId) =>
            Path.Combine(Root, "documents", "conversations", conversationId.ToString(), "attachments");
    }

    private static ConversationAttachmentBackfillService CreateService(
        FakeStorage storage,
        FakeMessageAttachmentStore store)
        => new(storage, store, NullLogger<ConversationAttachmentBackfillService>.Instance);

    [Fact]
    public async Task Backfill_UploadsSurvivingLocalFilesToDurableStore()
    {
        var storage = new FakeStorage(_root);
        var conversationId = Guid.NewGuid();
        var dir = storage.ConversationAttachmentsDirectory(conversationId);
        Directory.CreateDirectory(dir);
        var fileName = $"{Guid.NewGuid():N}.png";
        await File.WriteAllBytesAsync(Path.Combine(dir, fileName), [0x89, 0x50]);

        var store = new FakeMessageAttachmentStore();
        await CreateService(storage, store).StartAsync(CancellationToken.None);

        var remote = Assert.Single(store.Objects);
        Assert.Equal($"/documents/conversations/{conversationId}/attachments/{fileName}", remote.Key);
        Assert.Equal(new byte[] { 0x89, 0x50 }, remote.Value);
    }

    [Fact]
    public async Task Backfill_NoDurableStore_IsNoOp()
    {
        var storage = new FakeStorage(_root);
        var conversationId = Guid.NewGuid();
        var dir = storage.ConversationAttachmentsDirectory(conversationId);
        Directory.CreateDirectory(dir);
        await File.WriteAllBytesAsync(Path.Combine(dir, "a.png"), [0x89]);

        var store = new FakeMessageAttachmentStore(isDurable: false);
        await CreateService(storage, store).StartAsync(CancellationToken.None);

        Assert.Empty(store.Objects);
    }

    [Fact]
    public async Task Backfill_UploadFailure_IsBestEffortAndContinues()
    {
        var storage = new FakeStorage(_root);
        var conversationId = Guid.NewGuid();
        var dir = storage.ConversationAttachmentsDirectory(conversationId);
        Directory.CreateDirectory(dir);
        await File.WriteAllBytesAsync(Path.Combine(dir, "bad.png"), [0x89]);
        await File.WriteAllBytesAsync(Path.Combine(dir, "good.png"), [0xFA]);

        var store = new FakeMessageAttachmentStore();
        store.StoreFails = true;
        await CreateService(storage, store).StartAsync(CancellationToken.None);

        // Rejected uploads are logged and skipped, never a boot failure.
        Assert.Empty(store.Objects);
    }
}