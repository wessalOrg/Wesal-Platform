namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Durable, non-public storage for conversation message image attachments.
///
/// Conversation attachments were originally written only to the ephemeral container
/// filesystem, so an instance replacement or redeploy (Render free tier has no
/// persistent disk) silently erased the payment-proof images while their database rows
/// survived — leaving the Admin with a protected endpoint that correctly returns 404.
/// This store is the durable mirror: it persists the same bytes a separate private
/// bucket keeps from vanishing, while the local copy (when present) still serves as the
/// hot read path for messages sent before this store existed.
///
/// Like the identity-document store it deliberately exposes no public URL: callers
/// receive bytes and stream them through an already authorization-checked endpoint.
/// The relative URL handed to a store is always the one generated from the persisted
/// record, never client input, and the object key is bucket-relative and strictly
/// validated, so a stored value can never traverse to another object.
/// </summary>
public interface IMessageAttachmentStore
{
    /// <summary>
    /// Whether writes actually persist remotely. False for development/tests, where the
    /// container-local copy written by the conversation service is the entire story.
    /// </summary>
    bool IsDurable { get; }

    /// <summary>
    /// Persists the attachment bytes. Throws when the backing store rejects the write,
    /// so the caller never records a database row whose bytes will not survive a redeploy.
    /// </summary>
    Task StoreAsync(string relativeUrl, byte[] content, CancellationToken cancellationToken = default);

    /// <summary>Returns the stored bytes, or null when the object no longer exists.</summary>
    Task<Models.StoredDocumentContent?> TryReadAsync(string relativeUrl, CancellationToken cancellationToken = default);

    /// <summary>Best-effort removal; a missing object is not an error.</summary>
    Task DeleteAsync(string relativeUrl, CancellationToken cancellationToken = default);
}