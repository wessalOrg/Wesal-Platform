namespace Wesal.Application.Common.Interfaces;

/// <summary>
/// Resolves the storage root used for protected documents (owner identity documents and
/// conversation message attachments). Unlike hall media, this root is NEVER mapped into
/// the public static-file area: documents are only served through authenticated endpoints
/// whose paths are resolved from persisted URLs.
/// </summary>
public interface IDocumentStorage
{
    string Root { get; }

    string OwnerDocumentsDirectory(string ownerId);

    /// <summary>
    /// Directory holding conversation message image attachments (WESAL-TASK-4, Edit 4).
    /// Like every other document area this is never mapped into the public static-file
    /// tree; attachments are only streamed through the protected conversation endpoint.
    /// </summary>
    string ConversationAttachmentsDirectory(Guid conversationId);
}