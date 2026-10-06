namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Durable, non-public storage for a Hall Owner's identity document (US-OWNER-30).
///
/// Identity documents are personal ID data, so this abstraction deliberately exposes no
/// URL: callers receive bytes and stream them through an already authorization-checked
/// endpoint. There is no public read path, no signed-URL capability, and no bucket
/// traversal — the relative URL handed to a store is always the one generated from the
/// persisted record, never client input.
/// </summary>
public interface IIdentityDocumentStore
{
    /// <summary>
    /// Persists the document. Throws when the backing store rejects the write, so the
    /// caller never records a reference to bytes that do not exist.
    /// </summary>
    Task SaveAsync(string relativeUrl, byte[] content, CancellationToken cancellationToken = default);

    /// <summary>Returns the stored bytes, or null when the document no longer exists.</summary>
    Task<Models.StoredDocumentContent?> ReadAsync(string relativeUrl, CancellationToken cancellationToken = default);

    /// <summary>Best-effort removal; a missing document is not an error.</summary>
    Task DeleteAsync(string relativeUrl, CancellationToken cancellationToken = default);
}
