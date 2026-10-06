using Wesal.Application.Common.Interfaces;

namespace Wesal.Infrastructure.Documents;

/// <summary>
/// Development/tests message-attachment store (no durable layer).
///
/// The container-local copy is written and read by <c>ConversationService</c> itself, so
/// when no durable store is configured this implementation intentionally does nothing:
/// <see cref="IsDurable"/> is false, writes are no-ops, and reads always miss. The
/// uniform interface lets the service branch only on <see cref="IsDurable"/> instead of
/// the provider name.
/// </summary>
public sealed class LocalMessageAttachmentStore : IMessageAttachmentStore
{
    public static readonly LocalMessageAttachmentStore Instance = new();

    private LocalMessageAttachmentStore()
    {
    }

    public bool IsDurable => false;

    public Task StoreAsync(string relativeUrl, byte[] content, CancellationToken cancellationToken = default)
        => Task.CompletedTask;

    public Task<Wesal.Application.Common.Models.StoredDocumentContent?> TryReadAsync(
        string relativeUrl,
        CancellationToken cancellationToken = default)
        => Task.FromResult<Wesal.Application.Common.Models.StoredDocumentContent?>(null);

    public Task DeleteAsync(string relativeUrl, CancellationToken cancellationToken = default)
        => Task.CompletedTask;
}