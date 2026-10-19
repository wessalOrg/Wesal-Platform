using Wesal.Application.Common.Interfaces;
using Wesal.Application.Common.Models;

namespace Wesal.Tests.TestDoubles;

/// <summary>
/// In-memory durable message-attachment store for the attachment durability tests.
/// Records the persist/delete calls by relative URL so a test can assert exactly what
/// the conversation service mirrored, and can be told to reject writes or to have lost
/// objects, standing in for a storage outage or a redeploy-wiped container.
/// </summary>
internal sealed class FakeMessageAttachmentStore : IMessageAttachmentStore
{
    private readonly Dictionary<string, byte[]> _objects = new(StringComparer.Ordinal);

    public FakeMessageAttachmentStore(bool isDurable = true) => IsDurable = isDurable;

    public bool IsDurable { get; }

    /// <summary>When set, StoreAsync throws, standing in for a storage outage or a wrong bucket.</summary>
    public bool StoreFails { get; set; }

    public IReadOnlyDictionary<string, byte[]> Objects => _objects;

    /// <summary>Simulates the durable store having lost an object (e.g. wiped bucket/project).</summary>
    public void Clear() => _objects.Clear();

    public Task StoreAsync(string relativeUrl, byte[] content, CancellationToken cancellationToken = default)
    {
        if (StoreFails)
        {
            throw new InvalidOperationException("Simulated Supabase Storage outage.");
        }

        _objects[relativeUrl] = content;
        return Task.CompletedTask;
    }

    public Task<StoredDocumentContent?> TryReadAsync(string relativeUrl, CancellationToken cancellationToken = default)
        => Task.FromResult(_objects.TryGetValue(relativeUrl, out var bytes)
            ? (StoredDocumentContent?)new StoredDocumentContent { Bytes = bytes }
            : null);

    public Task DeleteAsync(string relativeUrl, CancellationToken cancellationToken = default)
    {
        _objects.Remove(relativeUrl);
        return Task.CompletedTask;
    }
}